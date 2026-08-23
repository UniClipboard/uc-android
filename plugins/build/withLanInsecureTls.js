"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchMainApplicationForLanInsecureTls = patchMainApplicationForLanInsecureTls;
const config_plugins_1 = require("expo/config-plugins");
const IMPORTS = [
    'import com.ReactNativeBlobUtil.ReactNativeBlobUtilUtils',
    'import java.security.cert.X509Certificate',
    'import javax.net.ssl.X509TrustManager',
];
const MARKER = 'ReactNativeBlobUtilUtils.sharedTrustManager';
const INIT = `    // Used only when a LAN profile explicitly enables the self-signed HTTPS option.
    ReactNativeBlobUtilUtils.sharedTrustManager = object : X509TrustManager {
      override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit

      override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = Unit

      override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
    }
`;
function patchMainApplicationForLanInsecureTls(contents) {
    let patched = contents;
    for (const importLine of IMPORTS) {
        if (!patched.includes(importLine)) {
            patched = patched.replace(/(^import .+$)(?![\s\S]*^import )/m, `$1\n${importLine}`);
        }
    }
    if (patched.includes(MARKER))
        return patched;
    const anchor = '    loadReactNative(this)';
    if (!patched.includes(anchor)) {
        throw new Error('withLanInsecureTls: unexpected MainApplication.kt template');
    }
    return patched.replace(anchor, `${INIT}${anchor}`);
}
const withLanInsecureTls = (config) => (0, config_plugins_1.withMainApplication)(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
        throw new Error('withLanInsecureTls: Kotlin MainApplication is required');
    }
    mod.modResults.contents = patchMainApplicationForLanInsecureTls(mod.modResults.contents);
    return mod;
});
exports.default = (0, config_plugins_1.createRunOncePlugin)(withLanInsecureTls, 'withLanInsecureTls', '1.0.0');
