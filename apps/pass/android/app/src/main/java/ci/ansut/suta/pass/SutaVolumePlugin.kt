package ci.ansut.suta.pass

import android.content.Context
import android.media.AudioManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.roundToInt

/**
 * Réglage du volume — aucun greffon publié ne sait le faire, celui-ci est maison.
 *
 * ── CE QUE CE GREFFON N'A PAS LE DROIT DE FAIRE ─────────────────────────
 *
 * Il ne décide de rien. Il reçoit EXACTEMENT le type `ReglerVolume` du lot 1
 * (packages/pass/src/actions.ts) : un `sens` parmi quatre valeurs, et un
 * `niveau` de 0 à 100 quand le sens vaut `definir`. Toute autre forme est
 * refusée. Il n'y a ici ni règle métier, ni formulation, ni interprétation de
 * la parole — seulement la traduction de quatre intentions en appels
 * `AudioManager`.
 *
 * ── AUCUNE EXCEPTION NE SORT ────────────────────────────────────────────
 *
 * `setStreamVolume` peut lever `SecurityException` sur certains terminaux
 * (politique « Ne pas déranger »). Le contrat du lot 1 exige qu'un refus soit
 * un RÉSULTAT : toutes les manipulations passent donc par un `try`, et le
 * greffon rend `permission_refusee` au lieu de faire tomber l'application.
 */
@CapacitorPlugin(name = "SutaVolume")
class SutaVolumePlugin : Plugin() {

    /** Le flux réglé. `STREAM_MUSIC` est celui que la personne entend quand
     * SUTA parle ; le régler ne touche ni la sonnerie, ni les alarmes. */
    private val flux = AudioManager.STREAM_MUSIC

    private fun gestionnaire(): AudioManager? =
        context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    private fun succes(): JSObject = JSObject().put("ok", true)

    private fun echec(code: String, detail: String): JSObject =
        JSObject().put("ok", false).put("code", code).put("detail", detail)

    @PluginMethod
    fun capacites(call: PluginCall) {
        call.resolve(JSObject().put("disponible", gestionnaire() != null))
    }

    @PluginMethod
    fun reglerVolume(call: PluginCall) {
        val audio = gestionnaire()
        if (audio == null) {
            call.resolve(echec("non_supporte", "AudioManager indisponible"))
            return
        }

        val sens = call.getString("sens")
        try {
            when (sens) {
                "monter" -> audio.adjustStreamVolume(flux, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                "baisser" -> audio.adjustStreamVolume(flux, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                // Couper = mettre le flux à zéro. On évite volontairement
                // ADJUST_MUTE et le mode silencieux global, qui relèvent de la
                // politique « Ne pas déranger » et exigent une autorisation
                // spéciale — pour un résultat que la personne n'a pas demandé.
                "couper" -> audio.setStreamVolume(flux, 0, AudioManager.FLAG_SHOW_UI)
                "definir" -> {
                    val niveau = call.getInt("niveau")
                    if (niveau == null || niveau < 0 || niveau > 100) {
                        call.resolve(echec("erreur_interne", "niveau attendu entre 0 et 100, reçu $niveau"))
                        return
                    }
                    val maximum = audio.getStreamMaxVolume(flux)
                    audio.setStreamVolume(flux, (maximum * niveau / 100f).roundToInt(), AudioManager.FLAG_SHOW_UI)
                }
                else -> {
                    call.resolve(echec("erreur_interne", "sens inconnu : $sens"))
                    return
                }
            }
        } catch (erreur: SecurityException) {
            call.resolve(echec("permission_refusee", "SecurityException: ${erreur.message}"))
            return
        } catch (erreur: RuntimeException) {
            call.resolve(echec("erreur_interne", "${erreur.javaClass.simpleName}: ${erreur.message}"))
            return
        }
        call.resolve(succes())
    }
}
