(function () {
  "use strict";

  /**
   * Displays logging information on the screen and in the console.
   * @param {string} msg - Message to log.
   */
  function log(msg) {
    var logsEl = document.getElementById("logs");

    if (msg) {
      // Update logs
      console.log("[PlayerAvplayDRM]: ", msg);
      logsEl.innerHTML += msg + "<br />";
    } else {
      // Clear logs
      logsEl.innerHTML = "";
    }

    logsEl.scrollTop = logsEl.scrollHeight;
  }

  var player;

  // flag to monitor UHD toggling
  var uhdStatus = false;

  // Configuration data for different DRM systems
  /**
   *
   * @property {String}            name             - name to be displayed in UI
   * @property {String}            url              - content url
   * @property {String}            licenseServer    - [Playready/Widevine] url to the license server
   * @property {String}            customData       - [Playready] extra data to add to the license request
   */
  var drms = {
    NO_DRM: {
      name: "No DRM",
      url: "http://playready.directtaps.net/smoothstreaming/SSWSS720H264/SuperSpeedway_720.ism/Manifest",
    },
    PLAYREADY: {
      name: "Playready",
      url: "http://playready.directtaps.net/smoothstreaming/SSWSS720H264PR/SuperSpeedway_720.ism/Manifest",
      licenseServer:
        "http://playready.directtaps.net/pr/svc/rightsmanager.asmx?PlayRight=1&UseSimpleNonPersistentLicense=1",
      customData: "",
    },
    PLAYREADY_GET_CHALLENGE: {
      name: "Playready GetChallenge",
      url: "http://playready.directtaps.net/smoothstreaming/SSWSS720H264PR/SuperSpeedway_720.ism/Manifest",
      licenseServer: "",
      customData: "",
    },
    WIDEVINE: {
      name: "Widevine",
      url: "https://d31ib6xnmsvhmh.cloudfront.net/1XqiKmKN_AZKkDKfMG149e32f_enc.mpd",
      //            url: 'http://commondatastorage.googleapis.com/wvmedia/starz_main_720p_6br_tp.wvm',
      //licenseServer: 'https://license.uat.widevine.com/getlicense/widevine',
      licenseServer: "https://vdrm.mobiotics.com/prod/proxy/v1/license",
      customData: "",
    },

    /*Smooth Streaming examples*/
    //			url:
    // 'http://playready.directtaps.net/smoothstreaming/SSWSS720H264/SuperSpeedway_720.ism/Manifest', url:
    // 'http://playready.directtaps.net/smoothstreaming/TTLSS720VC1/To_The_Limit_720.ism/Manifest',

    /*Smooth Streaming + Playready example*/
    //			url:
    // "http://playready.directtaps.net/smoothstreaming/SSWSS720H264PR/SuperSpeedway_720.ism/Manifest",
    // licenseServer:
    // 'http://playready.directtaps.net/pr/svc/rightsmanager.asmx?PlayRight=1&UseSimpleNonPersistentLicense=1'
  };

  /**
   * Register keys used in this application
   */
  function registerKeys() {
    var usedKeys = [
      "MediaPause",
      "MediaPlay",
      "MediaPlayPause",
      "MediaFastForward",
      "MediaRewind",
      "MediaStop",
      "0",
      "1",
      "2",
      "3",
    ];

    usedKeys.forEach(function (keyName) {
      tizen.tvinputdevice.registerKey(keyName);
    });
  }

  /**
   * Handle input from remote
   */
  function registerKeyHandler() {
    document.addEventListener("keydown", function (e) {
      switch (e.keyCode) {
        case 13: // Enter
          player.toggleFullscreen();
          break;
        case 38: //UP arrow
          switchDrm("up");
          break;
        case 40: //DOWN arrow
          switchDrm("down");
          break;
        case 10252: // MediaPlayPause
        case 415: // MediaPlay
        case 19: // MediaPause
          player.playPause();
          break;
        case 413: // MediaStop
          player.stop();
          break;
        case 417: // MediaFastForward
          player.ff();
          break;
        case 412: // MediaRewind
          player.rew();
          break;
        case 48: //key 0
          log();
          break;
        case 49: //Key 1
          setUhd();
          break;
        case 50: //Key 2
          player.getTracks();
          break;
        case 51: //Key 3
          player.getProperties();
          break;
        case 10009: // Return
          if (
            webapis.avplay.getState() !== "IDLE" &&
            webapis.avplay.getState() !== "NONE"
          ) {
            player.stop();
          } else {
            tizen.application.getCurrentApplication().hide();
          }
          break;
        default:
          log("Unhandled key");
      }
    });
  }

  /**
   * Display application version
   */
  function displayVersion() {
    var el = document.createElement("div");
    el.id = "version";
    el.innerHTML = "ver: " + tizen.application.getAppInfo().version;
    document.body.appendChild(el);
  }

  function registerMouseEvents() {
    document
      .querySelector(".video-controls .play")
      .addEventListener("click", function () {
        player.playPause();
        document.getElementById("streamParams").style.visibility = "visible";
      });
    document
      .querySelector(".video-controls .stop")
      .addEventListener("click", function () {
        player.stop();
        document.getElementById("streamParams").style.visibility = "hidden";
      });
    document
      .querySelector(".video-controls .pause")
      .addEventListener("click", player.playPause);
    document
      .querySelector(".video-controls .ff")
      .addEventListener("click", player.ff);
    document
      .querySelector(".video-controls .rew")
      .addEventListener("click", player.rew);
    document
      .querySelector(".video-controls .fullscreen")
      .addEventListener("click", player.toggleFullscreen);
  }

  /**
   * Create drm switching list
   */
  function createDrmList() {
    var drmParent = document.querySelector(".drms");
    var currentDrm;
    var li;
    for (var drmID in drms) {
      li = document.createElement("li");
      li.className = li.innerHTML = drms[drmID].name;
      li.dataset.drm = drmID;
      drmParent.appendChild(li);
    }
    currentDrm = drmParent.firstElementChild;
    currentDrm.classList.add("drmFocused");
  }

  /**
   * Enabling uhd manually in order to play uhd streams
   */
  function setUhd() {
    if (!uhdStatus) {
      if (webapis.productinfo.isUdPanelSupported()) {
        log("4k enabled");
        uhdStatus = true;
      } else {
        log(
          "this device does not have a panel capable of displaying 4k content"
        );
      }
    } else {
      log("4k disabled");
      uhdStatus = false;
    }
    player.setUhd(uhdStatus);
  }

  /**
   * Changes drm settings according to user's action
   * @param {String} direction - 'up' or 'down'
   */
  function switchDrm(direction) {
    var drmParent = document.querySelector(".drms");
    var currentDrm = drmParent.querySelector(".drmFocused");

    currentDrm.classList.remove("drmFocused");
    if (direction === "up") {
      if (currentDrm === drmParent.firstElementChild) {
        currentDrm = drmParent.lastElementChild;
      } else {
        currentDrm = currentDrm.previousElementSibling;
      }
    } else if (direction === "down") {
      if (currentDrm === drmParent.lastElementChild) {
        currentDrm = drmParent.firstElementChild;
      } else {
        currentDrm = currentDrm.nextElementSibling;
      }
    }
    currentDrm.classList.add("drmFocused");
    player.setChosenDrm(drms[currentDrm.dataset.drm]);
  }

  /**
   * Function initialising application.
   */
  window.onload = function () {
    if (window.tizen === undefined) {
      log("This application needs to be run on Tizen device");
      return;
    }
    /**
     * Player configuration object.
     *
     * @property {Object}           drms            - object containing drm configurations
     * @property {HTML Element}     player          - application/avplayer object
     * @property {HTML Div Element} controls        - player controls
     * @property {HTLM Div Element} info            - place to display stream info
     * @property {Function}         logger          - function to use for logging within player component
     *
     */
    // var config = {
    //   drms: drms,
    //   player: document.getElementById("av-player"),
    //   controls: document.querySelector(".video-controls"),
    //   info: document.getElementById("info"),
    //   logger: log,
    // };

    displayVersion();
    createDrmList();
    registerKeys();
    registerKeyHandler();

    //Check the screen width so that the AVPlay can be scaled accordingly
    // tizen.systeminfo.getPropertyValue(
    //   "DISPLAY",
    //   function (display) {
    //     log("The display width is " + display.resolutionWidth);
    //     config.resolutionWidth = display.resolutionWidth;

    //     // initialize player - loaded from videoPlayer.js
    //     player = new VideoPlayer(config);
    //     registerMouseEvents();
    //   },
    //   function (error) {
    //     log("An error occurred " + error.message);
    //   }
    // );
    // setup video player
    // player.init("av-player");
    //player.prepare("http://yourvideourl.mp4"); // <-- set video URL here!

    RegisterDevice(
      "TTvIl4+yhy/vw5UvJGixA2Xg5KhvhzKc7T7t93HxfBI8cbVno9hNoarQYBpea3Z3q4fsXkmo3NR/z0Jw0+zDYW5DhV7o7CO2CGjFs8pwQTrDk5OmbyjQuW8KZCfsk2kO",
      "547b4478f3edffcc07256c68a5c60c27c708e1a0",
      "noorplay"
    );
  };

  //   function initApp() {
  //     // Install built-in polyfills to patch browser incompatibilities.
  //     shaka.polyfill.installAll();
  //     document.getElementById("play").style.display = "none";
  //     const video = document.querySelector("video");

  //     video.addEventListener("canplay", (event) => {
  //       video.play().then(
  //         (res) => {
  //           console.log(res);
  //         },
  //         (err) => {
  //           console.log(err);
  //         }
  //       );
  //     });

  //     RegisterDevice(
  //       "TTvIl4+yhy/vw5UvJGixA2Xg5KhvhzKc7T7t93HxfBI8cbVno9hNoarQYBpea3Z3q4fsXkmo3NR/z0Jw0+zDYW5DhV7o7CO2CGjFs8pwQTrDk5OmbyjQuW8KZCfsk2kO",
  //       "547b4478f3edffcc07256c68a5c60c27c708e1a0",
  //       "noorplay"
  //     );
  //   }

  function GetEncryptedData(deviceId, providerId) {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    var urlencoded = new URLSearchParams();
    urlencoded.append("deviceid", deviceId);
    urlencoded.append("providerid", providerId);
    urlencoded.append("devicetype", "PC");

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow",
    };

    fetch(
      "https://vsms.mobiotics.com/prod/subscriberv2/v1/device/encrypt/" +
        providerId,
      requestOptions
    )
      // fetch("https://vsms.mobiotics.com/betav1/subscriberv2/v1/device/encrypt/" + providerId, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        RegisterDevice(data.encdata, data.hash, providerId);
      })
      .catch((error) => console.log("error", error));
  }

  function RegisterDevice(encryptedBody, hash, providerId) {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/octet-stream");

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: encryptedBody,
      redirect: "follow",
    };

    fetch(
      "https://vsms.mobiotics.com/prodv3/subscriberv2/v1/device/register/" +
        providerId +
        "?hash=" +
        hash,
      requestOptions
    )
      // fetch("https://vsms.mobiotics.com/betav1/subscriberv2/v1/device/register/"  + providerId + "?hash=" + hash, requestOptions)

      .then((response) => response.json())
      .then((data) => {
        console.log(data.success);
        LoginUser("tej@mobiotics.com", "Test@123", data.success, providerId);
      })
      .catch((error) => console.log("error", error));
  }

  function LoginUser(userName, password, deviceToken, providerId) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + deviceToken);

    var requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };

    fetch(
      "https://vsms.mobiotics.com/prodv3/subscriberv2/v1/login?email=" +
        userName +
        "&password=" +
        password +
        "&devicetype=PC&country=IN",
      requestOptions
    )
      // fetch("https://vsms.mobiotics.com/betav1/subscriberv2/v1/login?email=" + userName + "&password=" + password + "&devicetype=PC&country=IN", requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log(data.success);

        GetStreamUrl(
          "y8S9aDrzXAPp",
          "AZKkDKfMG149e32f",
          "4ASX2I2K",
          data.success,
          "noorplay"
        );
      })
      .catch((error) => {
        alert("login error");
      });
  }

  function GetStreamUrl(
    contentId,
    packageId,
    availabilityId,
    providerToken,
    providerId
  ) {
    var myHeaders = new Headers();
    myHeaders.append("X-SESSION", providerToken);
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    var urlencoded = new URLSearchParams();
    urlencoded.append("packageid", packageId);
    urlencoded.append("availabilityid", availabilityId);

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow",
    };

    // fetch("https://vcms.mobiotics.com/betav1/subscriber/v1/content/package/" + contentId, requestOptions)

    fetch(
      "https://vcms.mobiotics.com/prodv3/subscriber/v1/content/package/" +
        contentId,
      requestOptions
    )
      .then((response) => response.json())
      .then((data) => {
        console.log(data.success);
        GetDrmToken(
          contentId,
          packageId,
          availabilityId,
          providerToken,
          providerId
        );
      })
      .catch((error) => console.log("error", error));
  }
  function GetDrmToken(
    contentId,
    packageId,
    availabilityId,
    providerToken,
    providerId
  ) {
    var myHeaders = new Headers();
    myHeaders.append("X-SESSION", providerToken);
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    var urlencoded = new URLSearchParams();
    urlencoded.append("contentid", contentId);
    urlencoded.append("packageid", packageId);
    urlencoded.append("drmscheme", "WIDEVINE");
    urlencoded.append("availabilityid", availabilityId);
    //urlencoded.append("seclevel", "HW");

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow",
    };

    // fetch("https://vcms.mobiotics.com/betav1/subscriber/v1/content/drmtoken", requestOptions)

    fetch(
      "https://vcms.mobiotics.com/prodv3/subscriber/v1/content/drmtoken",
      requestOptions
    )
      .then((response) => response.json())
      .then((data) => {
        console.log(data.success);
        alert("DRM TOKEN:" + data.success);
        // initialize player - loaded from videoPlayer.js
        // config.resolutionWidth = display.resolutionWidth;
        var config = {
          drms: drms,
          player: document.getElementById("av-player"),
          controls: document.querySelector(".video-controls"),
          info: document.getElementById("info"),
          logger: log,
        };
        player = new VideoPlayer(config);
        registerMouseEvents();
        // if (shaka.Player.isBrowserSupported()) {
        //   window.shaka.polyfill.installAll();

        //   initPlayer(packageId, contentId, providerId, data.success);
        // } else {
        //   // This browser does not have the minimum set of APIs we need.
        //   console.error("Browser not supported!");
        // }
      })
      .catch((error) => console.log("error", error));
  }
})();
