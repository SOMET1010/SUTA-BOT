import { normalizeServerEvent } from "./events";

export type RealtimeConnectionState = "connecting" | "connected" | "disconnected";
const DATA_CHANNEL_OPEN_TIMEOUT_MS = 15_000;

export interface RealtimeClientCallbacks {
  onSpeechStarted?: () => void; onSpeechStopped?: () => void;
  onUserTranscriptDelta?: (delta:string)=>void; onUserTranscriptDone?: (transcript:string)=>void;
  onAssistantTranscriptDelta?: (delta:string)=>void; onAssistantTranscriptDone?: (transcript:string)=>void;
  onResponseCreated?:()=>void; onResponseDone?:()=>void;
  onConnectionStateChange?: (state:RealtimeConnectionState)=>void; onError?: (message:string)=>void;
}
export interface RealtimeClientOptions { clientSecret:string; webrtcUrl:string; executeTool:(name:string,argumentsJson:string)=>Promise<unknown>; callbacks?:RealtimeClientCallbacks; }

export class RealtimeClient {
  private peerConnection:RTCPeerConnection|null=null; private dataChannel:RTCDataChannel|null=null; private micStream:MediaStream|null=null; private audioEl:HTMLAudioElement|null=null; private hasActiveResponse=false;
  /** Compte les réponses ouvertes ; sert à détecter qu'une nouvelle réponse a démarré pendant l'exécution d'un outil. */
  private responseSeq=0;
  /** Un résultat d'outil attend que la réponse en cours se termine pour demander la suivante. */
  private pendingToolResponse=false;
  constructor(private readonly options:RealtimeClientOptions){}
  async connect():Promise<void>{
    if(this.peerConnection) throw new Error("RealtimeClient: connect() appelé deux fois sur la même instance.");
    this.options.callbacks?.onConnectionStateChange?.("connecting");
    try{this.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}catch{this.options.callbacks?.onConnectionStateChange?.("disconnected");throw new Error("Accès au microphone refusé ou indisponible. Autorisez l'accès au microphone puis réessayez.");}
    const pc=new RTCPeerConnection();this.peerConnection=pc;for(const track of this.micStream.getAudioTracks())pc.addTrack(track,this.micStream);
    this.audioEl=new Audio();this.audioEl.autoplay=true;pc.ontrack=(event)=>{if(this.audioEl){this.audioEl.srcObject=event.streams[0]??new MediaStream([event.track]);this.audioEl.play().catch(()=>this.options.callbacks?.onError?.("La lecture audio n'a pas pu démarrer automatiquement."));}};
    const dc=pc.createDataChannel("oai-events");this.dataChannel=dc;dc.onmessage=(e)=>this.handleServerEvent(e.data);dc.onerror=()=>this.options.callbacks?.onError?.("Erreur sur le canal de données Realtime.");
    pc.onconnectionstatechange=()=>{if(pc.connectionState==="connected")this.options.callbacks?.onConnectionStateChange?.("connected");else if(pc.connectionState==="failed"||pc.connectionState==="closed")this.options.callbacks?.onConnectionStateChange?.("disconnected");};
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);let response:Response;try{response=await fetch(this.options.webrtcUrl,{method:"POST",headers:{Authorization:`Bearer ${this.options.clientSecret}`,"Content-Type":"application/sdp"},body:offer.sdp});}catch{throw new Error("Connexion au service Realtime impossible (réseau).");}
    if(!response.ok)throw new Error(`Échec de l'établissement de la session Realtime (HTTP ${response.status}).`);await pc.setRemoteDescription({type:"answer",sdp:await response.text()});await this.waitForDataChannelOpen(dc);
  }
  private waitForDataChannelOpen(channel:RTCDataChannel):Promise<void>{if(channel.readyState==="open")return Promise.resolve();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("La session vocale n'a pas fini de s'ouvrir. Réessayez.")),DATA_CHANNEL_OPEN_TIMEOUT_MS);channel.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});channel.addEventListener("close",()=>{clearTimeout(timer);reject(new Error("La session vocale s'est fermée avant d'être prête."));},{once:true});});}
  disconnect():void{this.dataChannel?.close();this.dataChannel=null;this.peerConnection?.close();this.peerConnection=null;this.micStream?.getTracks().forEach(t=>t.stop());this.micStream=null;if(this.audioEl){this.audioEl.pause();this.audioEl.srcObject=null;this.audioEl=null;}this.hasActiveResponse=false;this.options.callbacks?.onConnectionStateChange?.("disconnected");}
  /** Un texte envoyé pendant que SUTA parle vaut interruption : on annule la
   * réponse en cours avant d'en demander une nouvelle, sinon le serveur
   * rejette le `response.create` (« already has an active response »). */
  sendUserText(text:string):void{if(this.hasActiveResponse)this.send({type:"response.cancel"});this.send({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text}]}});this.send({type:"response.create"});}
  /** Ajoute un contexte silencieux à la session sans déclencher de réponse. */
  addContext(text:string):void{if(!text.trim())return;this.send({type:"conversation.item.create",item:{type:"message",role:"system",content:[{type:"input_text",text}]}});}
  interrupt():void{if(this.hasActiveResponse)this.send({type:"response.cancel"});}
  private send(event:Record<string,unknown>):void{if(this.dataChannel?.readyState==="open")this.dataChannel.send(JSON.stringify(event));}
  private handleServerEvent(raw:string):void{let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return;}const event=normalizeServerEvent(parsed);if(!event)return;const c=this.options.callbacks;switch(event.type){case"speech_started":c?.onSpeechStarted?.();this.interrupt();break;case"speech_stopped":c?.onSpeechStopped?.();break;case"user_transcript_delta":c?.onUserTranscriptDelta?.(event.delta);break;case"user_transcript_done":c?.onUserTranscriptDone?.(event.transcript);break;case"assistant_transcript_delta":c?.onAssistantTranscriptDelta?.(event.delta);break;case"assistant_transcript_done":c?.onAssistantTranscriptDone?.(event.transcript);break;case"response_created":this.hasActiveResponse=true;this.responseSeq+=1;this.pendingToolResponse=false;c?.onResponseCreated?.();break;case"response_done":this.hasActiveResponse=false;if(this.pendingToolResponse){this.pendingToolResponse=false;this.send({type:"response.create"});}c?.onResponseDone?.();break;case"function_call_done":void this.runToolCall(event.callId,event.name,event.argumentsJson);break;case"error":c?.onError?.(event.message);}}
  private async runToolCall(callId:string,name:string,argumentsJson:string):Promise<void>{const seqAtCall=this.responseSeq;let output:unknown;try{output=await this.options.executeTool(name,argumentsJson);}catch(error){output={error:error instanceof Error?error.message:"Échec de l'outil."};}this.send({type:"conversation.item.create",item:{type:"function_call_output",call_id:callId,output:JSON.stringify(output)}});
    // Trois cas après avoir posé le résultat :
    // - une NOUVELLE réponse a démarré pendant la recherche (la personne a
    //   repris la parole) : ne rien demander, elle utilisera le résultat ;
    // - la réponse porteuse de l'appel est déjà close : demander la suite ;
    // - elle n'est pas encore close (course rare) : attendre son response.done
    //   avant de demander la suite, sinon le serveur rejette la création.
    if(this.responseSeq!==seqAtCall)return;
    if(!this.hasActiveResponse)this.send({type:"response.create"});
    else this.pendingToolResponse=true;}
}
