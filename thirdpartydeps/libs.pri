
linux-g++ {
    SUB_LIB = "linux"
}

linux-g++-32 {
    SUB_LIB = "linux"
}
linux-g++-64 {
    SUB_LIB = "linux"
}

macx {
    SUB_LIB = "macx"
}

linux-g++-32 {
    LIBS        += -lpaper
}
linux-g++-64 {
    LIBS        += -lpaper
}

linux-g++ {
    LIBS        += -lpaper

    LIBS += -lpoppler
    INCLUDEPATH += "/usr/include/poppler"

    LIBS += -lquazip5
    INCLUDEPATH += "/usr/include/quazip"
}

win32 {
    CONFIG( debug, debug|release ) {
        SUB_LIB = "win32/debug"
    } else {
        SUB_LIB = "win32/release"
    }

    # Libraries are now handled by local thirdpartydeps
    
    # OPENSSL
    INCLUDEPATH += "$$PWD/openssl/openssl-3.0.15-win64/include"
    LIBS += "-L$$PWD/openssl/openssl-3.0.15-win64/lib" -llibcrypto -llibssl

    # POPPLER
    POPPLER_DIR = "$$PWD/poppler"
    INCLUDEPATH += "$$POPPLER_DIR/include"
    INCLUDEPATH += "$$POPPLER_DIR/include/poppler"
    LIBS += "-L$$POPPLER_DIR/lib" -lpoppler -lpoppler-cpp

    # QUAZIP (freshly built in CI)
    QUAZIP_DIR = "$$PWD/quazip"
    exists("$$QUAZIP_DIR/lib/$$SUB_LIB/quazip.lib") {
         LIBS += "-L$$QUAZIP_DIR/lib/$$SUB_LIB" -lquazip
    }

    # Common Windows system libs
    LIBS += -lWmvcore -lWinmm -lUser32 -lGdi32 -lAdvApi32 -lOle32 -lStrmiids
}

macx {
    LIBS         += "-framework QuartzCore"
    LIBS         += "-framework AudioToolbox"
    LIBS         += "-framework CoreAudio"
    LIBS         += "-framework ApplicationServices"
    LIBS         += "-framework Cocoa"
            
    LIBS         += "-lcrypto"
}


