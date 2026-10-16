plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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
}