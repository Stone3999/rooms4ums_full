plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Procesa wearos/app/google-services.json. Sin este plugin el archivo se
    // ignora, FirebaseApp no se inicializa y FirebaseMessaging lanza.
    id("com.google.gms.google-services")
}

android {
    namespace = "com.rooms4ums.wear"
    compileSdk = 33

    defaultConfig {
        applicationId = "com.rooms4ums.wear"
        minSdk = 26
        targetSdk = 33
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.10.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // PRÁCTICA 1 - Wear OS: UI y ciclo de vida del wearable
    implementation("androidx.wear:wear:1.2.0")

    // PRÁCTICA 2 - IoT: Data Layer API sobre Bluetooth Low Energy
    implementation("com.google.android.gms:play-services-wearable:18.1.0")

    // PRÁCTICA 3 - Push remoto: el reloj registra su propio token FCM
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging")

    // Cliente HTTP del login propio y del registro del token
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Telemetría y registro del token fuera del hilo principal
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
