var otrswatcher={
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
  let kinds = ["queue", "watched", "responsible", "locked"];
  for each(let kind in kinds){
      cb(kind);
  }
}

function changeColor(colorpick){

  // the example label's id is the same as the colorpick's one except it's prefixed with "example."
  let idpart=colorpick.id;
  document.getElementById("example."+idpart).style.backgroundColor=colorpick.color;
}

function savePref() {
  let prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefBranch);

  let optprefix = "extensions.otrswatcher.";
  
  forEveryKind(
    function(kind){
      let color=document.getElementById(kind).color;
      prefs.setCharPref(optprefix + kind +".color", color);
    }
  );
  
  let checkintervall = document.getElementById("checkintervall").value;
  prefs.setIntPref(optprefix + "checkintervall", checkintervall);
  
  let queuefilter = document.getElementById("queuefilter").value;
  prefs.setCharPref(optprefix + "queuefilter", queuefilter);
    
  
  let otrsjsonurl = document.getElementById("otrsjsonurl").value;
  prefs.setCharPref(optprefix + "otrsjsonurl", otrsjsonurl);
  
  let on=document.getElementById("savepass").checked;
  prefs.setBoolPref(optprefix + "savepass", on);
  
  let CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
  let nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
					       Components.interfaces.nsILoginInfo,
					       "init");
  let username=document.getElementById("username").value;
  let password=document.getElementById("password").value;
  
  let authLoginInfo = new nsLoginInfo("otrswatcher-url", "OTRS Login", null, 
				      username, password, true, true);
  let loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
  let logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
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
  let optprefix = "extensions.otrswatcher.";
  let prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefService).getBranch(optprefix);

  
  forEveryKind(
    function(kind){
      try{
	let color = prefs.getCharPref(kind+".color");
	callback("color", kind, color);
      } catch (x) {

      }
    }
  );

  try{
    let checkintervall=prefs.getIntPref("checkintervall");
    callback("checkintervall", "checkintervall", checkintervall);
  } catch (x) {

  }

  try{
    let queuefilter=prefs.getCharPref("queuefilter");
    callback("queuefilter", "queuefilter", queuefilter);
  } catch (x) {

  }
  
  try{
    let otrsjsonurl = prefs.getCharPref("otrsjsonurl");
    callback("otrsjsonurl", "otrsjsonurl", otrsjsonurl);
  } catch (x) {

  }
  
  try{
    let savepass=prefs.getBoolPref("savepass");
    callback("savepass", "savepass", savepass);
  } catch (x) {

  }
  
}

function cbLoadPrefSettings(what, which, value){
  if(what == "color" && value != ""){
    let colorpick = document.getElementById(which);
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
      let up = getUserPass();
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
  let CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
  let loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
  let erg = ["", ""];
  
  try {
    let logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
    if (logins[0]) {
      erg = [logins[0].username, logins[0].password];
    }       
  }
  catch (e) {alert(e); }

  return erg;

}

function doRequest(url, username, password, onload, method, otherpara){
  let httpRequest = new XMLHttpRequest();
  

  onreadystatechange = function()
   { 
       if (httpRequest.readyState==4 && httpRequest.status==200 && httpRequest.responseText == ""){
	   dump(method + " - responseText is empty\n");
       }
       /*
else{	   
	   dump(method + " - readyState,status,statusText =" + httpRequest.readyState + ", " +httpRequest.status+ ", " +httpRequest.statusText +"\n");
       }
       */
   }; 
  let req = url+ "?Method="+method+"&User="+encodeURIComponent(username)+"&Password="+encodeURIComponent(password)+"&Object=iPhoneObject";
  if (otherpara != null) req=req+"&Data="+otherpara;
  //dump(req+"\n")
  httpRequest.open("GET", req, true);
  httpRequest.onload = function (){ onload(httpRequest.responseText); };
  httpRequest.onreadystatechange = onreadystatechange;
  httpRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
  httpRequest.send(null);
}

function doRequestTest(onload, method, otherpara){
  let username=document.getElementById("username").value;
  let password=document.getElementById("password").value;
  let otrsjsonurl = document.getElementById("otrsjsonurl").value;
  
  doRequest(otrsjsonurl, username, password, onload, method, otherpara);
  
}

function doRequestLive(onload, method, otherpara){
  let username="";
  let password="";
  if (otrswatcher.savepass){
    let up = getUserPass();
    username=up[0];
    password=up[1];
  }else{
    username=otrswatcher.username || "";
    password=otrswatcher.password || "";
  }
  let otrsjsonurl = otrswatcher.otrsjsonurl;
  
  if (otrsjsonurl == ""){
    onload('{"Result":"failed", "Message":"Please configure otrswatcher first"}');    
  }else{
    doRequest(otrsjsonurl, username, password, onload, method, otherpara);
  }
  
}

function testLogin(){
  let onload = function(responseText){
    
    let disp = [];
    if (responseText != ""){
	let result=getJSONResult(responseText);
      disp = [result.Result];
      if (result.Result == "successful"){
	let data = result.Data[0];
	for(let key in data) disp.push(key +"=" + data[key]);
	
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
  
  let onload = function(responseText){
    
    let disp = [];
    if (responseText != ""){
	let result=getJSONResult(responseText);
      if (result.Result == "successful"){
	let queues = result.Data;
	for each(let queue in queues) disp.push(queue.QueueName);
	
      }
    }else{
      disp = ["There was no output in the requests result."];
    }
    document.getElementById("myqueues").value=disp.join("|");
  };

  doRequestTest(onload, "QueueView");
  
}

function installTimer(){
  uninstallTimer();
  let milli = otrswatcher.checkintervall * 60 * 1000;
  otrswatcher.timerid = window.setInterval(updateStatusbar, milli);
}

function uninstallTimer(){
  if (otrswatcher.timerid != null)
    window.clearTimeout(otrswatcher.timerid);
  otrswatcher.timerid=null;
}


function countXXXTickets(methodname, kind, queuefunc, chainfunc){
  let onload = function(responseText){
    
    let count="?";
    let tttext=kind;
    let label=document.getElementById("otrswatcher." + kind);
    let bgcolor=label.parentNode.style.backgroundColor;
    
    if (responseText != ""){
	let result=getJSONResult(responseText);
      if (result.Result == "successful"){
	  // theres something odd - sometimes we get an "successfull" response, 
	  // but the Data is an empty array, while there ARE tickets to be counted
	  // if we get an empty array, we pretend we did not request anything yet
	  // thus keeping labels unchanged!
          if (result.Data.length == 0){
	      return;
	  }
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
    let tooltip=document.getElementById("otrswatcher."+kind+".tooltip");
    tooltip.label=tttext;
    if (chainfunc != null) chainfunc();
  };

  doRequestLive(onload, methodname);
}

function countFilteredQueueTickets(queues){

  let count=0;
  for each(let queue in queues){
    if (otrswatcher.queuefilter.indexOf("|"+queue.QueueName+"|") == -1) 
	count += parseInt(queue.NumberOfTickets,10);
  }
  return count;
}

function numberOfTicketsInAll(queues){
  let count="There was no result for the 'All' Filter.";
  for each(let queue in queues){
    if (queue.FilterName=="All") {
      count = parseInt(queue.NumberOfTickets,10);
      break;
    }
  }
  return count;
}

function countQueueTickets(){
    countXXXTickets("QueueView", "queue", countFilteredQueueTickets, countResponsibleTickets);
}


function countResponsibleTickets(){
    countXXXTickets("ResponsibleView", "responsible", numberOfTicketsInAll, countLockedTickets);
}

function countLockedTickets(){
    countXXXTickets("LockedView", "locked", numberOfTicketsInAll, countWatchedTickets);
}
  
function countWatchedTickets(){
  countXXXTickets("WatchedView", "watched", numberOfTicketsInAll);
}

function updateStatusbar(){
  countQueueTickets();
  //countWatchedTickets();
  //countResponsibleTickets();
  //countLockedTickets();
}

function openOTRS(queryString){
  
  if (otrswatcher.otrsjsonurl == ""){
    alert("Erst konfigurieren!");
  }else{
    let otrsjsonurl = otrswatcher.otrsjsonurl;
    let url = otrsjsonurl.replace('json.pl', 'index.pl');
    if (queryString != null){
      url = url + "?"+queryString;
    }
    window.content.open(url, "otrswatcher-otrs");
  }

}

function openTicket(QueueID, TicketID, ArticleID){
  let queryString ="Action=AgentTicketZoom&TicketID="+TicketID+"&ArticleID="+ArticleID+"&QueueID="+QueueID;
  openOTRS(queryString);
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


function listTicketsInQueueOrView(popup, method, QueueID){
  
  let gettickets = function(responseText){
    
    if (responseText != ""){
	let result=getJSONResult(responseText);
      if (result.Result == "successful"){
	for each(let ticket in result.Data){

	  let menuitem = document.createElement("menuitem");
	  let label = ticket.Title || ticket.Subject;
	  menuitem.setAttribute("label", label);
	  menuitem.setAttribute("oncommand", "openTicket("+ticket.QueueID+", "+ticket.TicketID+", "+ticket.ArticleID+");");
	  popup.appendChild(menuitem);
	}
      }
    }
  };

  if ((method=="QueueView" && popup.childNodes.length == 0) 
    || (method!="QueueView" && popup.childNodes.length == 3)){
    
    let prop1="Filter";
    if (method=="QueueView"){
      prop1 = '"QueueID":'+QueueID;
    }else{
      prop1 = '"Filter":"All"';
    }
    doRequestLive(gettickets, method, '{' + prop1 +', "Limit":10}');
  }

}

function listQueuesInMenu(popup){
 
  // 1. get queues 
  // 2. filter out disliked queues
  // 3. for every remaining queue get a list of max 10 entries and build a menupopup containing sender and subject for every entry
  // 4. insert those built menupopups as submenue in <popup>
  
  
  getqueues = function(responseText){
    
    let queues=new Array;
  
    if (responseText != ""){
	let result=getJSONResult(responseText);
      if (result.Result == "successful"){
	queues = result.Data;
      }
    }

    for each(let queue in queues){
      if (otrswatcher.queuefilter.indexOf("|"+queue.QueueName+"|") == -1){
	// create sub submenu

	let menu = document.createElement("menu");
	menu.setAttribute("label", queue.QueueName + "(" + queue.NumberOfTickets + ")");
	let submenuPopup = document.createElement("menupopup");
	submenuPopup.setAttribute("onpopupshowing", "listTicketsInQueueOrView(this, 'QueueView', "+queue.QueueID+");");
	menu.appendChild(submenuPopup);
	popup.appendChild(menu);

      }
    }
    
  };
  
  if (popup.childNodes.length < 4){
    doRequestLive(getqueues, "QueueView");
  }
}


function removeMenuEntries(popup, event){
   
  if (event.target.id == event.currentTarget.id){

    let range = document.createRange();
    let afterNode = popup.childNodes[2];
    let lastNode = popup.childNodes[popup.childNodes.length-1];
    range.setStartAfter(afterNode);
    range.setEndAfter(lastNode);
    range.deleteContents();
    
  }
}

function getJSONResult(result){
    let nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
	.createInstance(Components.interfaces.nsIJSON);
    return nativeJSON.decode(result);
}