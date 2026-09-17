package ci.ansut.suta.pass;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Les deux greffons maison sont enregistrés AVANT super.onCreate : c'est là
 * que Capacitor construit son pont, et un greffon enregistré après ne serait
 * pas visible depuis la WebView.
 *
 * Les greffons publiés (caméra, contacts, réseau) sont découverts seuls à
 * partir des paquets npm — ils n'ont pas à figurer ici.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SutaVolumePlugin.class);
        registerPlugin(SutaLauncherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
