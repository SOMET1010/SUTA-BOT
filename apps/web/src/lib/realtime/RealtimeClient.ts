import { normalizeServerEvent } from "./events";
import { BargeInGate, BARGE_IN_CONFIRM_MS } from "./interruption";
import { bargeInConfigFromUrl, vlog, type BargeInMode } from "./voice-debug";

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
  private responseSeq=0; private cancelledResponseSeq=-1;
  /** Un résultat d'outil attend que la réponse en cours se termine pour demander la suivante. */
  private pendingToolResponse=false;
  /** Détection « annonce sans suite » : le modèle dit « un instant, je
   * regarde… », termine sa réponse SANS appeler l'outil, et plus rien ne
   * vient (3 occurrences mesurées au banc : V-SAFE run 4, V-MEMOIRE tour 2 et
   * V-COUPURE run 7). Quand la réponse terminée est une courte annonce de
   * recherche sans tool call, on relance UNE fois : le modèle enchaîne alors
   * réellement (recherche ou réponse). */
  private lastAssistantText=""; private toolCallSeen=false; private relancesThisTurn=0;
  /** Filtre les faux barge-in (bruit bref, respiration) pendant que SUTA parle. */
  private readonly bargeIn:BargeInGate;
  /** Réglage diagnostic lu de l'URL (?bargein=off | half | <ms>). */
  private readonly bargeInMode:BargeInMode;
  private readonly bargeInConfirmMs:number;
  /** Instant du dernier speech_started, pour journaliser la durée de parole. */
  private speechStartedAt=0;
  /** Un même function_call_done ne doit jamais déclencher deux recherches
   * (événements dupliqués observés en réel — repris de l'expérimentation
   * voice-stability-half-duplex). */
  private readonly handledToolCallIds=new Set<string>();
  /** Garde secondaire : même outil + mêmes arguments dans la même réponse. */
  private readonly handledToolKeys=new Set<string>();
  constructor(private readonly options:RealtimeClientOptions){
    const config=bargeInConfigFromUrl();
    this.bargeInMode=config.mode;
    this.bargeInConfirmMs=config.confirmMs??BARGE_IN_CONFIRM_MS;
    this.bargeIn=new BargeInGate(this.bargeInConfirmMs);
    if(config.mode==="off")vlog("barge-in DÉSACTIVÉ pour cette session (?bargein=off) : la parole pendant une réponse n'annule rien");
    else if(config.mode==="half")vlog("mode HALF-DUPLEX (?bargein=half) : micro coupé pendant que SUTA parle, aucune interruption possible");
    else if(config.confirmMs)vlog("délai de confirmation barge-in ajusté",{confirmMs:config.confirmMs});
  }
  /** Half-duplex : couper/rendre le micro sans toucher à la connexion. */
  private setMicEnabled(enabled:boolean):void{if(this.bargeInMode!=="half")return;this.micStream?.getAudioTracks().forEach((track)=>{track.enabled=enabled;});vlog("micro",{actif:enabled,mode:"half-duplex"});}
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
  disconnect():void{this.bargeIn.reset();this.handledToolCallIds.clear();this.handledToolKeys.clear();this.dataChannel?.close();this.dataChannel=null;this.peerConnection?.close();this.peerConnection=null;this.micStream?.getTracks().forEach(t=>t.stop());this.micStream=null;if(this.audioEl){this.audioEl.pause();this.audioEl.srcObject=null;this.audioEl=null;}this.hasActiveResponse=false;this.options.callbacks?.onConnectionStateChange?.("disconnected");}
  /** Un texte envoyé pendant que SUTA parle vaut interruption : on annule la
   * réponse en cours avant d'en demander une nouvelle, sinon le serveur
   * rejette le `response.create` (« already has an active response »). */
  sendUserText(text:string):void{this.interrupt();this.send({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text}]}});this.send({type:"response.create"});}
  /** Ajoute un contexte silencieux à la session sans déclencher de réponse. */
  addContext(text:string):void{if(!text.trim())return;this.send({type:"conversation.item.create",item:{type:"message",role:"system",content:[{type:"input_text",text}]}});}
  /** La réponse qui vient de finir n'était-elle qu'une annonce de recherche
   * jamais suivie d'effet ? Courte, contenant une formule d'attente, sans
   * tool call — et au plus UNE relance par tour utilisateur (jamais de
   * boucle : si la relance produit encore une annonce, on laisse tel quel et
   * le banc le mesurera). */
  private estAnnonceSansSuite():boolean{
    if(this.toolCallSeen||this.relancesThisTurn>0)return false;
    const texte=this.lastAssistantText.trim();
    if(!texte||texte.length>160)return false;
    // Formules relevées sur les runs réels 4 à 8 — le gabarit court (< 160
    // caractères) écarte les vraies réponses qui commencent pareil.
    return /(un instant|je regarde|je v[ée]rifie|je consulte|laissez[- ]moi|on va (regarder|voir)|voyons (ensemble|ça|cela)|je (re)?cherche|je vais (regarder|v[ée]rifier|chercher|voir)|je vous explique)/i.test(texte);
  }
  /** Au plus UNE annulation par réponse, quel que soit l'appelant. Banc vocal
   * run n°6 (V-INTERRUPTION) : la garde BargeInGate annulait puis notifiait le
   * hook, qui rappelait interrupt() — la réponse n'étant pas encore marquée
   * terminée, deux response.cancel partaient pour une seule interruption, et
   * le second pouvait tuer la NOUVELLE réponse en course. */
  interrupt():void{const envoye=this.hasActiveResponse&&this.responseSeq!==this.cancelledResponseSeq;vlog("response.cancel",{envoye});if(!envoye)return;this.cancelledResponseSeq=this.responseSeq;this.send({type:"response.cancel"});}
  private send(event:Record<string,unknown>):void{if(this.dataChannel?.readyState==="open")this.dataChannel.send(JSON.stringify(event));}
  private handleServerEvent(raw:string):void{let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return;}const event=normalizeServerEvent(parsed);if(!event)return;const c=this.options.callbacks;switch(event.type){
      // L'annulation n'est plus réflexe : pendant une réponse, elle attend la
      // confirmation de la garde (parole soutenue). La coupure automatique du
      // VAD serveur est désactivée (interrupt_response:false, côté provider) —
      // c'est donc ici, et seulement ici, que SUTA peut être interrompue.
      case"speech_started":{this.speechStartedAt=performance.now();this.relancesThisTurn=0;vlog("speech_started",{reponseActive:this.hasActiveResponse});
        // Modes ?bargein=off / half : pendant une réponse, la parole est
        // journalisée mais n'annule jamais — si la voix se coupe encore, la
        // cause n'est pas le barge-in client. (En half, le micro est coupé :
        // cet événement ne devrait même plus arriver.)
        if(this.bargeInMode!=="normal"&&this.hasActiveResponse){vlog(`BargeInGate : ignoré (mode ${this.bargeInMode})`);break;}
        this.bargeIn.speechStarted(this.hasActiveResponse,()=>c?.onSpeechStarted?.(),()=>{vlog("BargeInGate : barge-in CONFIRMÉ",{parolesSoutenuesMs:this.bargeInConfirmMs,dureeReelleMs:Math.round(performance.now()-this.speechStartedAt)});this.interrupt();c?.onSpeechStarted?.();});break;}
      case"speech_stopped":{const dureeMs=this.speechStartedAt>0?Math.round(performance.now()-this.speechStartedAt):null;const fausseAlerte=this.bargeIn.speechStopped();vlog("speech_stopped",{dureeMs,decision:fausseAlerte?"BargeInGate : fausse alerte (bruit bref, rien annulé)":"hors garde"});c?.onSpeechStopped?.();break;}case"user_transcript_delta":c?.onUserTranscriptDelta?.(event.delta);break;case"user_transcript_done":c?.onUserTranscriptDone?.(event.transcript);break;case"assistant_transcript_delta":c?.onAssistantTranscriptDelta?.(event.delta);break;case"assistant_transcript_done":
        // Chronologie du run n°15 (V-COUPURE) : une même réponse peut émettre
        // DEUX transcript_done à quelques ms d'écart, le second vide — il
        // écrasait le texte juste avant le test de la relance, qui restait
        // muette. Un transcript vide n'écrase jamais le texte mémorisé.
        if(event.transcript&&event.transcript.trim())this.lastAssistantText=event.transcript;
        // Second point de déclenchement de la relance : le transcript audio
        // arrive parfois APRÈS response.done (run réel n°9 : « Laissez-moi
        // poser le cadre… » — au moment du test à response.done, le texte
        // était encore vide et la relance n'a pas tiré).
        if(!this.hasActiveResponse&&this.estAnnonceSansSuite()){this.relancesThisTurn+=1;vlog("relance : annonce sans suite",{texte:this.lastAssistantText.slice(0,80)});this.send({type:"response.create"});}
        c?.onAssistantTranscriptDone?.(event.transcript);break;case"response_created":vlog("response.created");this.hasActiveResponse=true;this.responseSeq+=1;this.pendingToolResponse=false;this.toolCallSeen=false;this.lastAssistantText="";this.handledToolKeys.clear();this.setMicEnabled(false);c?.onResponseCreated?.();break;case"response_done":vlog("response.done",{suiteOutilEnAttente:this.pendingToolResponse});this.hasActiveResponse=false;this.setMicEnabled(true);if(this.pendingToolResponse){this.pendingToolResponse=false;this.send({type:"response.create"});}else if(this.estAnnonceSansSuite()){this.relancesThisTurn+=1;vlog("relance : annonce sans suite",{texte:this.lastAssistantText.slice(0,80)});this.send({type:"response.create"});}c?.onResponseDone?.();break;case"function_call_done":this.toolCallSeen=true;void this.runToolCall(event.callId,event.name,event.argumentsJson);break;case"error":c?.onError?.(event.message);}}
  private async runToolCall(callId:string,name:string,argumentsJson:string):Promise<void>{
    // Dédoublonnage : un function_call_done rejoué (par call_id) ou un même
    // outil avec les mêmes arguments dans la même réponse ne relance rien —
    // deux recherches identiques enchaînées déstabilisaient la réponse.
    const key=`${this.responseSeq}:${name}:${argumentsJson}`;
    if(this.handledToolCallIds.has(callId)||this.handledToolKeys.has(key)){vlog("tool_call dupliqué ignoré",{callId,name});return;}
    this.handledToolCallIds.add(callId);this.handledToolKeys.add(key);
    const seqAtCall=this.responseSeq;let output:unknown;try{output=await this.options.executeTool(name,argumentsJson);}catch(error){output={error:error instanceof Error?error.message:"Échec de l'outil."};}this.send({type:"conversation.item.create",item:{type:"function_call_output",call_id:callId,output:JSON.stringify(output)}});
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
