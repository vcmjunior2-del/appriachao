#!/usr/bin/env bash
# Prepara o projeto nativo no Codemagic. As pastas android/ e ios/ não ficam no repositório:
# são geradas a cada build a partir do código web e recebem aqui os ajustes para as lojas.
# Uso: bash scripts/native-setup.sh android | ios
set -euo pipefail
PLATFORM="$1"
BUILD="${BUILD_NUMBER:-1}"

npx cap add "$PLATFORM"

# Ícone e tela de abertura a partir de assets/logo.png (PNG 1024x1024), quando existir
if [ -f assets/logo.png ]; then
  npx --yes @capacitor/assets generate --"$PLATFORM" --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
fi

if [ "$PLATFORM" = android ]; then
  # Configuração do app Android no Firebase (firebase apps:sdkconfig ANDROID). Fica aqui porque
  # o AI Studio não envia google-services.json ao GitHub
  cat > android/app/google-services.json <<'EOF'
{
  "project_info": {
    "project_number": "39795669276",
    "firebase_url": "https://appriachao-default-rtdb.firebaseio.com",
    "project_id": "appriachao",
    "storage_bucket": "appriachao.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:39795669276:android:1eeb2fb4f8fcc12da322d9",
        "android_client_info": {
          "package_name": "com.riachao.cidadao"
        }
      },
      "oauth_client": [
        {
          "client_id": "39795669276-hfnbgfplfu2lqpl23pqo13lj5nt6c5vh.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyBtqvND_l_pdX_33g4nzcPbZ8kY2oue7A8"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "39795669276-hfnbgfplfu2lqpl23pqo13lj5nt6c5vh.apps.googleusercontent.com",
              "client_type": 3
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
}
EOF
  # Permissões: GPS, câmera (fotos das ocorrências) e notificações
  perl -0pi -e 's#</manifest>#    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>#' android/app/src/main/AndroidManifest.xml
  # Cada envio à Google Play precisa de um número de versão maior que o anterior
  perl -pi -e "s/versionCode 1\b/versionCode $BUILD/" android/app/build.gradle
  exit 0
fi

# --- iOS ---
# Configuração do app iOS no Firebase (firebase apps:sdkconfig IOS). Fica aqui porque o AI Studio não edita .plist
cat > ios/App/App/GoogleService-Info.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CLIENT_ID</key>
	<string>39795669276-hb05t796kodlgb2eil0c2pd7c52j0b7q.apps.googleusercontent.com</string>
	<key>REVERSED_CLIENT_ID</key>
	<string>com.googleusercontent.apps.39795669276-hb05t796kodlgb2eil0c2pd7c52j0b7q</string>
	<key>API_KEY</key>
	<string>AIzaSyDUM2HrBXf4DQHjEMuPq_c-K1CQSvtnDn0</string>
	<key>GCM_SENDER_ID</key>
	<string>39795669276</string>
	<key>PLIST_VERSION</key>
	<string>1</string>
	<key>BUNDLE_ID</key>
	<string>com.riachao.cidadao</string>
	<key>PROJECT_ID</key>
	<string>appriachao</string>
	<key>STORAGE_BUCKET</key>
	<string>appriachao.firebasestorage.app</string>
	<key>IS_ADS_ENABLED</key>
	<false></false>
	<key>IS_ANALYTICS_ENABLED</key>
	<false></false>
	<key>IS_APPINVITE_ENABLED</key>
	<true></true>
	<key>IS_GCM_ENABLED</key>
	<true></true>
	<key>IS_SIGNIN_ENABLED</key>
	<true></true>
	<key>GOOGLE_APP_ID</key>
	<string>1:39795669276:ios:a9e79aab70d3590ca322d9</string>
	<key>DATABASE_URL</key>
	<string>https://appriachao-default-rtdb.firebaseio.com</string>
</dict>
</plist>
EOF

# Textos dos pedidos de permissão (obrigatórios na App Store) e notificações em segundo plano
PLIST=ios/App/App/Info.plist
pb() { /usr/libexec/PlistBuddy -c "$1" "$PLIST"; }
pb "Set :CFBundleDevelopmentRegion pt-BR"
pb "Set :UIRequiredDeviceCapabilities:0 arm64"
pb "Add :NSCameraUsageDescription string 'Para tirar fotos do problema ao registrar uma ocorrência.'"
pb "Add :NSPhotoLibraryUsageDescription string 'Para anexar fotos da galeria às suas ocorrências e ao seu perfil.'"
pb "Add :NSLocationWhenInUseUsageDescription string 'Para marcar no mapa o local da ocorrência e mostrar serviços perto de você.'"
pb "Add :UIBackgroundModes array"
pb "Add :UIBackgroundModes:0 string remote-notification"
pb "Add :ITSAppUsesNonExemptEncryption bool false"

# Permissão de notificações push (o perfil de assinatura precisa ter Push Notifications)
cat > ios/App/App/App.entitlements <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>
EOF

# Inclui o GoogleService-Info.plist e as permissões no projeto Xcode, define o número do build
# e repassa o token de push ao plugin do Firebase (xcodeproj já vem instalado no Mac do Codemagic)
ruby - "$BUILD" <<'RUBY'
require 'xcodeproj'
build = ARGV[0]
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = project.targets.find { |t| t.name == 'App' }
target.resources_build_phase.add_file_reference(project.main_group['App'].new_reference('GoogleService-Info.plist'))
target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  config.build_settings['CURRENT_PROJECT_VERSION'] = build
end
project.save

delegate = 'ios/App/App/AppDelegate.swift'
push = <<~SWIFT
  // Notificações push: repassa o token do aparelho para o Capacitor/Firebase
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
      NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
      NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
  }
SWIFT
File.write(delegate, File.read(delegate).sub(/\n}\s*\z/, "\n#{push.gsub(/^(?=.)/, '    ')}}\n"))
RUBY
