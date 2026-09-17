package ci.ansut.suta.pass

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Lancement d'applications et ouverture du composeur — maison, faute de
 * greffon publié qui sache interroger `PackageManager`.
 *
 * ── LE PARTAGE DU TRAVAIL, ET POURQUOI IL EST AINSI ─────────────────────
 *
 *   Kotlin ÉNUMÈRE      `listerApplications` rend la liste BRUTE, sans filtrer
 *                       ni trier par pertinence.
 *   TypeScript APPARIE  `correspondance.ts` décide, avec la normalisation de
 *                       `@suta/pass` — et applique la règle des homonymes.
 *   Kotlin EXÉCUTE      `ouvrirPaquet` et `ouvrirComposeur` reçoivent une cible
 *                       DÉJÀ désignée.
 *
 * Ce découpage sert la consigne « pas de logique métier dupliquée en Kotlin ».
 * Si ce greffon choisissait lui-même l'application la plus probable, la règle
 * vivrait hors de portée des tests, et serait à réécrire le jour d'un portage.
 *
 * ── L'APPEL N'EST JAMAIS ÉMIS ───────────────────────────────────────────
 *
 * `ouvrirComposeur` utilise `ACTION_DIAL`, qui pré-remplit le clavier et rend
 * la main à la personne. Jamais `ACTION_CALL`, qui appellerait directement.
 * C'est la consigne « aucune action sensible exécutée silencieusement », et
 * cela dispense du même coup de la permission `CALL_PHONE`, restreinte par
 * Google Play.
 */
@CapacitorPlugin(name = "SutaLauncher")
class SutaLauncherPlugin : Plugin() {

    private fun succes(): JSObject = JSObject().put("ok", true)

    private fun echec(code: String, detail: String): JSObject =
        JSObject().put("ok", false).put("code", code).put("detail", detail)

    @PluginMethod
    fun capacites(call: PluginCall) {
        val disponible = context?.packageManager != null
        call.resolve(
            JSObject()
                .put("listerApplications", disponible)
                .put("ouvrirComposeur", disponible),
        )
    }

    /**
     * Les applications que la personne peut ouvrir depuis son écran d'accueil.
     *
     * Le filtre `MAIN` + `LAUNCHER` est celui des lanceurs Android. Il exige la
     * déclaration `<queries>` du manifeste sur Android 11 et au-delà — et non
     * la permission `QUERY_ALL_PACKAGES`, que Google Play restreint fortement.
     */
    @PluginMethod
    fun listerApplications(call: PluginCall) {
        val gestionnaire = context?.packageManager
        if (gestionnaire == null) {
            call.resolve(echec("non_supporte", "PackageManager indisponible"))
            return
        }
        val intention = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val applications = JSArray()
        try {
            for (resolution in gestionnaire.queryIntentActivities(intention, 0)) {
                val paquet = resolution.activityInfo?.packageName ?: continue
                val libelle = resolution.loadLabel(gestionnaire).toString().trim()
                if (libelle.isEmpty()) continue
                applications.put(JSObject().put("libelle", libelle).put("paquet", paquet))
            }
        } catch (erreur: RuntimeException) {
            call.resolve(echec("erreur_interne", "${erreur.javaClass.simpleName}: ${erreur.message}"))
            return
        }
        call.resolve(JSObject().put("applications", applications))
    }

    @PluginMethod
    fun ouvrirPaquet(call: PluginCall) {
        val paquet = call.getString("paquet")
        if (paquet.isNullOrBlank()) {
            call.resolve(echec("erreur_interne", "paquet manquant"))
            return
        }
        val gestionnaire = context?.packageManager
        val lancement = gestionnaire?.getLaunchIntentForPackage(paquet)
        if (lancement == null) {
            call.resolve(echec("introuvable", "aucune activité de lancement pour $paquet"))
            return
        }
        lancement.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        demarrer(call, lancement)
    }

    @PluginMethod
    fun ouvrirComposeur(call: PluginCall) {
        val numero = call.getString("numero")
        if (numero.isNullOrBlank()) {
            call.resolve(echec("erreur_interne", "numéro manquant"))
            return
        }
        // ACTION_DIAL, jamais ACTION_CALL : la personne garde le dernier mot.
        val intention = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", numero, null))
        intention.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        demarrer(call, intention)
    }

    /** Aucune exception ne sort : chaque échec devient un code du contrat. */
    private fun demarrer(call: PluginCall, intention: Intent) {
        try {
            activity.startActivity(intention)
        } catch (erreur: ActivityNotFoundException) {
            call.resolve(echec("introuvable", "ActivityNotFoundException: ${erreur.message}"))
            return
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
