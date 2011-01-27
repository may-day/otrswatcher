otrswatcher={
  "username":"",
  "password":"",
  "otrsjsonurl":"",
  "timerid":null
};

/**
 * Based on what the user has checked to list in the statusbar and what display
 * arrangement he chose, we display an example.
 */

function forEveryKind(cb){
  // go through every checkbox
  kinds = ["queue", "watched", "responsible", "locked"];
  for each(var kind in kinds){
      cb(kind);
  }
}

function changeColor(colorpick){

  // the example label's id is the same as the colorpick's one except it's prefixed with "example."
  var idpart=colorpick.id;
  document.getElementById("example."+idpart).style.backgroundColor=colorpick.color;
}

function savePref() {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefBranch);

  var optprefix = "extensions.otrswatcher.";
  
  forEveryKind(
    function(kind){
      var color=document.getElementById(kind).color;
      prefs.setCharPref(optprefix + kind +".color", color);
    }
  );
  
  var checkintervall = document.getElementById("checkintervall").value;
  prefs.setIntPref(optprefix + "checkintervall", checkintervall);
  
  var queuefilter = document.getElementById("queuefilter").value;
  prefs.setCharPref(optprefix + "queuefilter", queuefilter);
    
  
  var otrsjsonurl = document.getElementById("otrsjsonurl").value;
  prefs.setCharPref(optprefix + "otrsjsonurl", otrsjsonurl);
  
  var on=document.getElementById("savepass").checked;
  prefs.setBoolPref(optprefix + "savepass", on);
  
  var CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
  var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
					       Components.interfaces.nsILoginInfo,
					       "init");
  var username=document.getElementById("username").value;
  var password=document.getElementById("password").value;
  
  var authLoginInfo = new nsLoginInfo("otrswatcher-url", "OTRS Login", null, 
				      username, password, true, true);
  var loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
  var logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
  try {
      if (logins[0]) {
        loginManager.removeLogin(logins[0]);
      }
      
  }
  catch (e) {  alert(e); }
  
  if (on && username != "" && password != ""){
    try {
      loginManager.addLogin(authLoginInfo);
    }
    catch (e) { alert(e); }
  }
  
}


function loadPref(callback) {
  var optprefix = "extensions.otrswatcher.";
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefService).getBranch(optprefix);

  
  forEveryKind(
    function(kind){
      try{
	var color = prefs.getCharPref(kind+".color");
	callback("color", kind, color);
      } catch (x) {

      }
    }
  );

  try{
    var checkintervall=prefs.getIntPref("checkintervall");
    callback("checkintervall", "checkintervall", checkintervall);
  } catch (x) {

  }

  try{
    var queuefilter=prefs.getCharPref("queuefilter");
    callback("queuefilter", "queuefilter", queuefilter);
  } catch (x) {

  }
  
  try{
    var otrsjsonurl = prefs.getCharPref("otrsjsonurl");
    callback("otrsjsonurl", "otrsjsonurl", otrsjsonurl);
  } catch (x) {

  }
  
  try{
    var savepass=prefs.getBoolPref("savepass");
    callback("savepass", "savepass", savepass);
  } catch (x) {

  }
  
}

function cbLoadPrefSettings(what, which, value){
  if(what == "color" && value != ""){
    var colorpick = document.getElementById(which);
    colorpick.color = value;
    changeColor(colorpick);
  }else if (what == "checkintervall"){
    document.getElementById("checkintervall").value = value;
  }else if (what == "otrsjsonurl"){
    document.getElementById("otrsjsonurl").value = value;
  }else if (what == "queuefilter"){
    document.getElementById("queuefilter").value = value;
  }else if (what == "savepass"){
    document.getElementById("savepass").checked = value;
    if (value){
      var up = getUserPass();
      document.getElementById("username").value = up[0];
      document.getElementById("password").value = up[1];
    }
  }
}

function onloadSettings(){

  loadPref(cbLoadPrefSettings);
  
}

function cbLoadPrefStatusbar(what, which, value){
  
  if(what == "color" && value != ""){
  
    otrswatcher["otrswatcher."+ which] = value;
    
  }else if (what == "checkintervall"){
    // install new timer to call otrs
    otrswatcher["checkintervall"]=value;
  }else if (what == "otrsjsonurl"){
    otrswatcher["otrsjsonurl"] = value;
  }else if (what == "queuefilter"){
    otrswatcher["queuefilter"] = "|"+value + "|";
  }else if (what == "savepass"){
    otrswatcher["savepass"] = value;
  }
}

function onloadStatusbar(){
  
  loadPref(cbLoadPrefStatusbar);
  installTimer();
  updateStatusbar();
  
}

function getUserPass(){
  var CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
  var loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
  var erg = ["", ""];
  
  try {
    var logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
    if (logins[0]) {
      erg = [logins[0].username, logins[0].password];
    }       
  }
  catch (e) {alert(e); }

  return erg;

}

function doRequest(url, username, password, onload, method, otherpara){
  var httpRequest = new XMLHttpRequest();
  
  var thisonload=function (){
    onload(httpRequest.responseText);
  };
  
  var req = url+ "?Method="+method+"&User="+encodeURIComponent(username)+"&Password="+encodeURIComponent(password)+"&Object=iPhoneObject";
  if (otherpara != null) req=req+"&Data="+otherpara;
  httpRequest.open("GET", req, true);
  httpRequest.onload = thisonload;
  httpRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
  httpRequest.send(null);
}

function doRequestTest(onload, method, otherpara){
  var username=document.getElementById("username").value;
  var password=document.getElementById("password").value;
  var otrsjsonurl = document.getElementById("otrsjsonurl").value;
  
  var httpRequest = new XMLHttpRequest();
  
  var thisonload=function (){
    onload(httpRequest.responseText);
  };
  
  doRequest(otrsjsonurl, username, password, onload, method, otherpara);
  
}

function doRequestLive(onload, method, otherpara){
  var username="";
  var password="";
  if (otrswatcher.savepass){
    var up = getUserPass();
    username=up[0];
    password=up[1];
  }else{
    username=otrswatcher.username || "";
    password=otrswatcher.password || "";
  }
  var otrsjsonurl = otrswatcher.otrsjsonurl;
  
  if (otrsjsonurl == ""){
    result='{"Result":"failed", "Message":"Please configure otrswatcher first"}';
    onload(result);    
  }else{
    
  
    var httpRequest = new XMLHttpRequest();
  
    var thisonload=function (){
      onload(httpRequest.responseText);
    };
  
    doRequest(otrsjsonurl, username, password, onload, method, otherpara);
  }
  
}

function testLogin(){
  var onload = function(responseText){
    
    var disp = [];
    if (responseText != ""){
      eval("result="+responseText);
      disp = [result.Result];
      if (result.Result == "successful"){
	var data = result.Data[0];
	for(var key in data) disp.push(key +"=" + data[key]);
	
      }
    }else{
      disp = ["There was no output in the requests result."];
    }
      document.getElementById("accesstest").value=disp.join(", ");
  };

  doRequestTest(onload, "VersionGet");
  
}

function clearTestResult(){
  
  document.getElementById("accesstest").value="";
}

function dispMyQueues(){
  
  var onload = function(responseText){
    
    var disp = [];
    if (responseText != ""){
      eval("result="+responseText);
      if (result.Result == "successful"){
	var queues = result.Data;
	for each(var queue in queues) disp.push(queue.QueueName);
	
      }
    }else{
      disp = ["There was no output in the requests result."];
    }
    document.getElementById("myqueues").value=disp.join("|");
  };

  doRequest(onload, "QueueView");
  
}

function installTimer(){
  uninstallTimer();
  var milli = otrswatcher.checkintervall * 60 * 1000;
  otrswatcher.timerid = window.setInterval(updateStatusbar, milli);
}

function uninstallTimer(){
  if (otrswatcher.timerid != null)
    window.clearTimeout(otrswatcher.timerid);
  otrswatcher.timerid=null;
}


function countXXXTickets(methodname, kind, queuefunc){
  var onload = function(responseText){
    
    var count="?";
    var tttext=kind;
    var label=document.getElementById("otrswatcher." + kind);
    var bgcolor=label.parentNode.style.backgroundColor;
    
    if (responseText != ""){
      eval("result="+responseText);
      if (result.Result == "successful"){
	count=queuefunc(result.Data);
	if (isNaN(parseInt(count,10))){
	  tttext = count;
	  count="?";
	}else if (parseInt(count,10) != 0){
	  bgcolor = otrswatcher["otrswatcher."+ kind];
	}
      }else if (result.Result == "failed"){
	tttext = result.Message;
      }else{
	tttext = responseText;
      }
    }else{
      tttext = "There was no output in the requests result.";
    }
    
    label.value=count;
    label.style.backgroundColor = bgcolor;
    var tooltip=document.getElementById("otrswatcher."+kind+".tooltip");
    tooltip.label=tttext;
  };

  doRequestLive(onload, methodname);
}

function countFilteredQueueTickets(queues){

  var count=0;
  for each(var queue in queues){
    if (otrswatcher.queuefilter.indexOf(queue.QueueName) == -1) count += parseInt(queue.NumberOfTickets,10);
  }
  return count;
}

function numberOfTicketsInAll(queues){
  var count="There was no result for the 'All' Filter.";
  for each(var queue in queues){
    if (queue.FilterName=="All") {
      count = parseInt(queue.NumberOfTickets,10);
      break;
    }
  }
  return count;
}

function countQueueTickets(){
  countXXXTickets("QueueView", "queue", countFilteredQueueTickets);
}


function countResponsibleTickets(){
  countXXXTickets("ResponsibleView", "responsible", numberOfTicketsInAll);
}

function countLockedTickets(){
  countXXXTickets("LockedView", "locked", numberOfTicketsInAll);
}
  
function countWatchedTickets(){
  countXXXTickets("WatchedView", "watched", numberOfTicketsInAll);
}

function updateStatusbar(){
  countQueueTickets();
  countWatchedTickets();
  countResponsibleTickets();
  countLockedTickets();
}

function openOTRS(){
  
  if (otrswatcher.otrsjsonurl == ""){
    alert("Erst konfigurieren!");
  }else{
    var otrsjsonurl = otrswatcher.otrsjsonurl;
    var url = otrsjsonurl.replace('json.pl', 'index.pl');
    window.content.open(url, "otrswatcher-otrs");
  }

}

/**
 * From: http://xulsolutions.blogspot.com/search/label/uninstall
 
 */
const MY_EXTENSION_UUID = "otrswatcher@kraemer.norman.at.googlemail.com";

function initializeOverlay() {
UninstallObserver.register();
}

var UninstallObserver = {
_uninstall : false,
observe : function(subject, topic, data) {
  if (topic == "em-action-requested") {
    subject.QueryInterface(Components.interfaces.nsIUpdateItem);

    if (subject.id == MY_EXTENSION_UUID) {
      if (data == "item-uninstalled") {
        this._uninstall = true;
      } else if (data == "item-cancel-action") {
        this._uninstall = false;
      }
    }
  } else if (topic == "quit-application-granted" || topic == "quit-application") {
    if (this._uninstall) {
      var prefs = Components.classes["@mozilla.org/preferences-service;1"].
	getService(Components.interfaces.nsIPrefBranch);

      prefs.deleteBranch("extensions.otrswatcher");
      
      var CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
      var loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
      var logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
      try {
	if (logins[0]) {
          loginManager.removeLogin(logins[0]);
	}
      
      }catch(e){}
      
    }
    this.unregister();
  }
},
register : function() {
 var observerService =
   Components.classes["@mozilla.org/observer-service;1"].
     getService(Components.interfaces.nsIObserverService);

 observerService.addObserver(this, "em-action-requested", false);
 observerService.addObserver(this, "quit-application-granted", false);
},
unregister : function() {
  var observerService =
    Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);

  observerService.removeObserver(this,"em-action-requested");
  observerService.removeObserver(this,"quit-application-granted");
}
}
