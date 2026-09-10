/* ============================================================
   Wrapper SCORM (SCORM 1.2 y SCORM 2004) para el Simulador DEA/RCP.
   - Busca el API del LMS en la ventana/frames padres.
   - Inicializa la sesión y marca cmi.core.lesson_status / cmi.completion_status.
   - Detecta la finalización observando el texto de la pantalla final
     ("...completado") sin necesidad de modificar el componente React.
   - Hace commit y finaliza la sesión al cerrar/salir.
   ============================================================ */
(function () {
  var API = null;
  var apiVersion = null; // "1.2" | "2004"
  var initialized = false;
  var completed = false;

  function findAPI(win) {
    var attempts = 0;
    while (win && attempts < 10) {
      if (win.API) return { api: win.API, version: "1.2" };
      if (win.API_1484_11) return { api: win.API_1484_11, version: "2004" };
      if (win.parent && win.parent !== win) {
        win = win.parent;
      } else {
        break;
      }
      attempts++;
    }
    return null;
  }

  function locateAPI() {
    var found = findAPI(window);
    if (!found && window.opener) {
      found = findAPI(window.opener);
    }
    return found;
  }

  function init() {
    var found = locateAPI();
    if (!found) {
      console.warn("[SCORM] No se encontró el API del LMS (se ejecuta fuera de un LMS o el paquete no se lanzó correctamente). El simulador funcionará igual, solo sin reportar progreso.");
      return;
    }
    API = found.api;
    apiVersion = found.version;

    var result =
      apiVersion === "1.2" ? API.LMSInitialize("") : API.Initialize("");

    if (result === "true" || result === true) {
      initialized = true;
      setValue("cmi.core.lesson_status", "incomplete", "cmi.completion_status", "incomplete");
      commit();
    } else {
      console.warn("[SCORM] No se pudo inicializar la sesión con el LMS.");
    }
  }

  function setValue(key12, val12, key2004, val2004) {
    if (!initialized || !API) return;
    if (apiVersion === "1.2") {
      API.LMSSetValue(key12, val12);
    } else {
      API.SetValue(key2004, val2004);
    }
  }

  function commit() {
    if (!initialized || !API) return;
    if (apiVersion === "1.2") {
      API.LMSCommit("");
    } else {
      API.Commit("");
    }
  }

  function finishSession() {
    if (!initialized || !API) return;
    commit();
    if (apiVersion === "1.2") {
      API.LMSFinish("");
    } else {
      API.Terminate("");
    }
    initialized = false;
  }

  function markCompleted() {
    if (completed) return;
    completed = true;

    var scoreEl = document.querySelector("[data-scorm-score]");
    var rawScore = scoreEl ? scoreEl.getAttribute("data-scorm-score") : null;
    var evalMode = scoreEl && scoreEl.getAttribute("data-scorm-mode") === "evaluation";

    setValue("cmi.core.lesson_status", "completed", "cmi.completion_status", "completed");

    if (rawScore !== null && !isNaN(parseFloat(rawScore))) {
      setValue("cmi.core.score.raw", rawScore, "cmi.score.raw", rawScore);
      setValue("cmi.core.score.min", "0", "cmi.score.min", "0");
      setValue("cmi.core.score.max", "100", "cmi.score.max", "100");
      // SCORM 2004 además admite success_status; solo lo reportamos en modo Evaluación,
      // ya que en Aprendizaje/Práctica la nota es informativa, no un intento calificado.
      if (evalMode) {
        setValue("cmi.core.lesson_status", parseFloat(rawScore) >= 80 ? "passed" : "failed",
                  "cmi.success_status", parseFloat(rawScore) >= 80 ? "passed" : "failed");
      }
    }

    setValue("cmi.core.exit", "", "cmi.exit", "");
    commit();
  }

  function watchForCompletion() {
    var observer = new MutationObserver(function () {
      var text = document.body ? document.body.innerText || "" : "";
      if (text.indexOf("completado") !== -1) {
        markCompleted();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.addEventListener("DOMContentLoaded", function () {
    init();
    watchForCompletion();
  });

  window.addEventListener("beforeunload", function () {
    finishSession();
  });
})();
