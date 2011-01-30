function OTRSWatcher(){
  this.username = "";
  this.password = "";
  this.otrsjsonurl = "";
  this.timerid = null;

  this.optprefix = "extensions.otrswatcher";
  this.MY_EXTENSION_UUID = "otrswatcher@kraemer.norman.at.googlemail.com";

  this.prefvars = [
    //["what its about", "name in prefs", "type", "id in optionsdialog"]
    ["checkintervall", "checkintervall", "int", "checkintervall"],
    ["queuefilter", "queuefilter", "char", "queuefilter"],
    ["otrsjsonurl", "otrsjsonurl", "char", "otrsjsonurl"]
  ];
  

  this.kinds = {"queue":"QueueView", 
		"watched":"WatchedView", 
		"responsible":"ResponsibleView", 
		"locked":"LockedView"
	       };
  
  /**
   * Get the view associated with a kind.
   * @param {String} kind
   * @return {String} the viewname associated with the kind.
   */
  this.viewOfKind = function (kind){
    return this.kinds[kind];
  };
  
  /**
   * For every kind of view call a callback.
   * 
   * @param {Function} cb callback that gets called for every kind with the kind value as sole parameter.
   */

  this.forEveryKind = function (cb){
    for (let kind in this.kinds){
      cb.apply(this, [kind]);
    }
  };

  /**
   * Load the pref settings and hand it to a callback.
   * 
   * @param {Function} callback get called for every value read from the pref system
   */
  this.loadPref = function (callback) {
    let prefs = Components.classes["@mozilla.org/preferences-service;1"].
      getService(Components.interfaces.nsIPrefService).getBranch(this.optprefix+".");
    
    var accessfunc = {
      "char":prefs.getCharPref,
      "int":prefs.getIntPref
    };
    
    for each(let [what,which,preftype, elementid] in this.prefvars){
      try{
	callback.apply(this, [what, which, accessfunc[preftype](which), elementid]);
      } catch (x) {
      }
    }
    
  };
  
  /**
   * After object creation initialisation.
   * @return {OTRSWatcher} this
   */
  this.init = function(){
    this.forEveryKind(function(kind){
			this.prefvars.push(["color", kind+".color", "char", kind]);});
    return this;
  };
  
  
  /**
   * Read values from the options dialog and store them in the preference system.
   */
  this.savePref = function () {
    let prefs = Components.classes["@mozilla.org/preferences-service;1"].
      getService(Components.interfaces.nsIPrefService).getBranch(this.optprefix+".");
    /*
     let prefs = Components.classes["@mozilla.org/preferences-service;1"].
     getService(Components.interfaces.nsIPrefBranch);
     */

  
    var accessfunc = {
      "char":prefs.setCharPref,
      "int":prefs.setIntPref
    };
    
    for each(let [what,which,preftype, elementid] in this.prefvars){
      let value=document.getElementById(elementid).value;
      accessfunc[preftype](which, value);
    }
  
    let username=document.getElementById("username").value;
    let password=document.getElementById("password").value;
    this.userPass(username, password);
  
  };
  
  /**
   * Returns username & password.
   * If both are given as parameter overwrites current with new values (and returns previous pair).
   * 
   * @param {String} username optional
   * @param {String} password optional
   * @return {Array} [username, password]
   */
  this.userPass = function (username, password){
    let CC_loginManager = Components.classes["@mozilla.org/login-manager;1"];
    let loginManager = CC_loginManager.getService(Components.interfaces.nsILoginManager);
    let erg = ["", ""];
    let doSave = (username != null && password != null);
    
    try {
      let logins = loginManager.findLogins({}, "otrswatcher-url", "OTRS Login", null);
      if (logins[0]) {
	erg = [logins[0].username, logins[0].password];
	if (doSave){
	  loginManager.removeLogin(logins[0]);
	}
      }       
    }
    catch (e) {alert(e); }
    
    if (doSave && username != "" && password != ""){
      let nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
						   Components.interfaces.nsILoginInfo,
						   "init");
      let authLoginInfo = new nsLoginInfo("otrswatcher-url", "OTRS Login", null, 
					  username, password, true, true);
      try {
	loginManager.addLogin(authLoginInfo);
      }
      catch (e) { alert(e); }
    }

    return erg;
  };
  
  /**
   * Once the user changes the color in the optionsdialog,
   * we update an example label with the background color.
   * 
   * @param {Element} colorpick The colorpicker element
   */
  this.changeColorOnExample = function (colorpick){
    // the example label's id is the same as the colorpick's one except it's prefixed with "example."
    let idpart=colorpick.id;
    document.getElementById("example."+idpart).style.backgroundColor=colorpick.color;
  };
  
  
  /**
   * The method called on the "load" event of the options dialog.
   */
  this.onloadSettings = function (){
    
    let initfunc=function (what, which, value, elementid){
      if (value != ""){
	var el=document.getElementById(elementid);
	el.value = value;
	if(what == "color"){ el.color=value; this.changeColorOnExample(el); }
      }
    };
    
    this.loadPref(initfunc);
    let up = this.userPass();
    document.getElementById("username").value = up[0];
    document.getElementById("password").value = up[1];
  };


  /**
   * The method called on the "load" event of this extensions overlay.
   */
  this.onloadStatusbar = function (){
    this.loadPref(function (what, which, value, elementid){
		    if(value != ""){
		      this[which] = value;
		    }
		  });
		  
    this.installTimer();
    
  };
  
  /**
   * We setup and execute a request to the otrs site.
   * @param {String} url The json.pl url to call.
   * @param {String} username
   * @param {String} password
   * @param {Function} onload this will be called with the requests responseText as sole parameter.
   * @param {String} method one of the methos supports by iPhoneHandle, usually QueueView, LockedView, WatchedView etc.
   * @param {String} otherpara optional the value for the Data parameter in iPhoneHandle, e.g. '{"Filter":"All", "Limit":10}'
   */
  this.doRequest = function (url, username, password, onload, method, otherpara){
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
    let otrswatcher=this;
    httpRequest.open("GET", req, true);
    httpRequest.onload = function (){ onload.apply(otrswatcher, [httpRequest.responseText]); };
    httpRequest.onreadystatechange = onreadystatechange;
    httpRequest.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
    httpRequest.send(null);
  };
  
  
  /**
   * We call the OTRS site from the options dialog.
   * Here we use the value the user provides and which are not yet in the preference system.
   * 
   * @param {Function} onload this will be called with the requests responseText as sole parameter.
   * @param {String} method one of the methos supports by iPhoneHandle, usually QueueView, LockedView, WatchedView etc.
   * @param {String} [otherpara] the value for the Data parameter in iPhoneHandle, e.g. '{"Filter":"All", "Limit":10}'
   */
  this.doRequestTest = function (onload, method, otherpara){
    let username=document.getElementById("username").value;
    let password=document.getElementById("password").value;
    let otrsjsonurl = document.getElementById("otrsjsonurl").value;
    
    this.doRequest(otrsjsonurl, username, password, onload, method, otherpara);
    
  };

  /**
   * We call the OTRS site with values from the preference system.
   * 
   * @param {Function} onload this will be called with the requests responseText as sole parameter.
   * @param {String} method one of the methos supports by iPhoneHandle, usually QueueView, LockedView, WatchedView etc.
   * @param {String} [otherpara] the value for the Data parameter in iPhoneHandle, e.g. '{"Filter":"All", "Limit":10}'
   */
  this.doRequestLive = function (onload, method, otherpara){
    
    if (this.otrsjsonurl == ""){
      onload.apply(this,['{"Result":"failed", "Message":"Please configure otrswatcher first"}']);
    }else{
      let up = this.userPass();
      let username=up[0];
      let password=up[1];
      this.doRequest(this.otrsjsonurl, username, password, onload, method, otherpara);
    }
    
  };
  
  /**
   * We call the VersionGet method in orer to check wether user provided values are correct.
   * The result is displayed in the "accesstest" label.
   */
  this.testLogin = function (){
    let onload = function(responseText){
      
      let disp = [];
      if (responseText != ""){
	let result=this.getJSONResult(responseText);
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

    this.doRequestTest(onload, "VersionGet");
    
  };
  
  /**
   * Clear the value from the testLogin. This is called if the values in url, usernbame, or password change.
   */
  this.clearTestResult = function (){
    
    document.getElementById("accesstest").value="";
  };
  
  /**
   * Display the queues ('|'-separated) the user can access.
   * This is to help the user to set up an queuefilter of queues he wants to ignore.
   */
  this.dispMyQueues = function (){
    
    let onload = function(responseText){
      
      let disp = [];
      if (responseText != ""){
	let result=this.getJSONResult(responseText);
	if (result.Result == "successful"){
	  let queues = result.Data;
	  for each(let queue in queues) disp.push(queue.QueueName);
	  
	}
      }else{
	disp = ["There was no output in the requests result."];
      }
      document.getElementById("myqueues").value=disp.join("|");
    };

    this.doRequestTest(onload, "QueueView");
    
  };
  
  /**
   * Install a timer to perisically call the otrs site to check for new/changed tickets.
   */
  this.installTimer = function (){
    this.uninstallTimer();
    let milli = this.checkintervall * 60 * 1000;
    this.timerid = window.setInterval(this.checkTickets, milli);
    // and check tickets immediate
    this.checkTickets();
  };
  
  /**
   * Uninstalls the times to check for new/changed tickets.
   */
  this.uninstallTimer= function (){
    if (this.timerid != null)
      window.clearTimeout(this.timerid);
    this.timerid=null;
  };

  
  /**
   * Extracts the relevant number of tickets returned from a
   * call to otrs and updates the statusbar with color, label- and tooltiptext.
   * 
   * @param {String} kind which ont to update, e.g. "watched"
   * @param {Function} countfunc a function extraction the Number of Tickets from the Data property of the otrs result
   * @param {Function} chainfunc if present its called as last operation. Used to chain the calls to otrs. 
   */
  this.countTickets = function (kind, countfunc, chainfunc){
    let onload = function(responseText){
      
      let count="?";
      let tttext=kind;
      let label=document.getElementById("otrswatcher." + kind);
      let bgcolor=label.parentNode.style.backgroundColor;
      
      if (responseText != ""){
	let result=this.getJSONResult(responseText);
	if (result.Result == "successful"){
	  // theres something odd - sometimes we get an "successfull" response, 
	  // but the Data is an empty array, while there ARE tickets to be counted
	  // if we get an empty array, we pretend we did not request anything yet
	  // thus keeping labels unchanged!
          if (result.Data.length == 0){
	    return;
	  }
	  count=countfunc.apply(this, [result.Data]);
	  if (isNaN(parseInt(count,10))){
	    tttext = count;
	    count="?";
	  }else if (parseInt(count,10) != 0){
	    bgcolor = this[kind+".color"];
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
      if (chainfunc != null) chainfunc.apply(this);
    };

    this.doRequestLive(onload, this.viewOfKind(kind));
  };
  
  /**
   * One of the countfunc supplied to the countTickets method.
   * It sums up the number of tickets in all queues not ignored.
   * 
   * @param {Array} queues, an array of queues as returned in the Data property in a call to QueueView.
   * @return {int} number of tickets
   */
  this.countFilteredQueueTickets = function (queues){

    let count=0;
    let qf = "|"+this.queuefilter+"|";
    for each(let queue in queues){
      if (qf.indexOf("|"+queue.QueueName+"|") == -1) 
	count += parseInt(queue.NumberOfTickets,10);
    }
    return count;
  };
  
  
  /**
   * One of the countfunc supplied to the countTickets method.
   * It looks for the result in 'All' Filter in the Data Property as returned in the Data property in a call to (Watched|Locked|...)View.
   * 
   * @param {Array} queues, an array of queues as returned in the Data property in a call to LockedView for instance.
   * @return {int} number of tickets
   */
  this.numberOfTicketsInAll = function (queues){
    let count="There was no result for the 'All' Filter.";
    for each(let queue in queues){
      if (queue.FilterName=="All") {
	count = parseInt(queue.NumberOfTickets,10);
	break;
      }
    }
    return count;
  };
  
  /**
   * Count tickets in queue.
   */
  this.countQueueTickets = function (){
    this.countTickets("queue", this.countFilteredQueueTickets, this.countResponsibleTickets);
  };

  /**
   * Count responsible tickets .
   */
  this.countResponsibleTickets = function (){
    this.countTickets("responsible", this.numberOfTicketsInAll, this.countLockedTickets);
  };

  /**
   * Count locked tickets .
   */
  this.countLockedTickets = function (){
    this.countTickets("locked", this.numberOfTicketsInAll, this.countWatchedTickets);
  };
  
  /**
   * Count watched tickets .
   */
  this.countWatchedTickets = function (){
    this.countTickets("watched", this.numberOfTicketsInAll);
  };
  
  /**
   * Initiate requesting all ticket counts. this is called from the installed timer.
   */
  this.checkTickets=function (){
    //alert("checktickets this="+this);

    this.countQueueTickets();
    //countWatchedTickets();
    //countResponsibleTickets();
    //countLockedTickets();
  };
  
  /**
   * Locate the OTRS site in the browser. If given, display a specified ticket.
   * 
   * @param {String} QueueID optinal queueid of ticket to display in browser
   * @param {String} TicketID optinal ticketid of ticket to display in browser
   * @param {String} ArticleID optinal articleid of ticket to display in browser
   */
  this.openOTRS = function (QueueID, TicketID, ArticleID){
    
    if (otrswatcher.otrsjsonurl == ""){
      alert("Erst konfigurieren!");
    }else{
      let otrsjsonurl = this.otrsjsonurl;
      let url = otrsjsonurl.replace('json.pl', 'index.pl');
      if (QueueID != null && TicketID != null && ArticleID != null ){
	url = url + "?Action=AgentTicketZoom&TicketID="+TicketID+"&ArticleID="+ArticleID+"&QueueID="+QueueID;
      }
      window.content.open(url, "otrswatcher-otrs");
    }

  };

  /**
   * Request tickets in a queue or view and append them as menuentries to the popup element.
   * 
   * @param {Element} popup a menupopup which will contain the tickets as menuentries
   * @param {String} method a method to call to collect the tickets from otrs, e.g. QueueView or LockedView
   * @param {String} QueueID if method is "QueueView" the this is needed to specify the queue, otherwise ignored
   */
  this.listTicketsInQueueOrView = function (popup, method, QueueID){
    
    let gettickets = function(responseText){
      
      if (responseText != ""){
	let result=this.getJSONResult(responseText);
	if (result.Result == "successful"){
	  for each(let ticket in result.Data){

	    let menuitem = document.createElement("menuitem");
	    let label = ticket.Title || ticket.Subject;
	    menuitem.setAttribute("label", label);
	    menuitem.setAttribute("oncommand", "otrswatcher.openOTRS("+ticket.QueueID+", "+ticket.TicketID+", "+ticket.ArticleID+");");
	    popup.appendChild(menuitem);
	  }
	}
      }
    };

    if (popup.childNodes.length == 0){
      
      let prop1="Filter";
      if (method=="QueueView"){
	prop1 = '"QueueID":'+QueueID;
      }else{
	this.prepPopup(popup);
	prop1 = '"Filter":"All"';
      }
      
      this.doRequestLive(gettickets, method, '{' + prop1 +', "Limit":10}');
    }

  };

  /**
   * List the queue the user wants to see as submenuentries in popup.
   * @param {Element} popup a menupopup which will contain the queuenames as submenuentries
   */
  this.listQueuesInMenu = function (popup){
    
    
    // 1. get queues 
    // 2. filter out disliked queues
    // 3. for every remaining queue get a list of max 10 entries and build a menupopup containing sender and subject for every entry
    // 4. insert those built menupopups as submenue in <popup>
    
    
    getqueues = function(responseText){
      
      let queues=new Array;
      
      if (responseText != ""){
	let result=this.getJSONResult(responseText);
	if (result.Result == "successful"){
	  queues = result.Data;
	}
      }
      
      let qf = "|"+this.queuefilter+"|";
      for each(let queue in queues){
	if (qf.indexOf("|"+queue.QueueName+"|") == -1){
	  // create sub submenu

	  let menu = document.createElement("menu");
	  menu.setAttribute("label", queue.QueueName + "(" + queue.NumberOfTickets + ")");
	  let submenuPopup = document.createElement("menupopup");
	  submenuPopup.setAttribute("onpopupshowing", "otrswatcher.listTicketsInQueueOrView(this, 'QueueView', "+queue.QueueID+");");
	  menu.appendChild(submenuPopup);
	  popup.appendChild(menu);

	}
      }
      
    };
    
    if (popup.childNodes.length == 0){
      this.prepPopup(popup);
      this.doRequestLive(getqueues, "QueueView");
    }
  };
  
  /**
   * Copy menuentries from the "otrsmenu" into popup.
   * 
   * @param {Element} popup a menupopup which will contain copies of the entries in otrsmenue
   */
  this.prepPopup = function (popup){
    let range = document.createRange();
    range.selectNodeContents(document.getElementById("otrsmenu"));
    popup.appendChild(range.cloneContents());
  };
  
  /**
   * Removes all menuentries from popup. This is the onpopuphidden handler.
   * 
   * @param {Element} popup a menupopup which will gets its entries removed.
   * @event {Event} event
   */
  this.removeMenuEntries = function (popup, event){
    
    if (event.target.id == event.currentTarget.id){

      let range = document.createRange();
      range.selectNodeContents(popup);
      range.deleteContents();
      
    }
  };
  
  /**
   * Decode a given JSON type text into an actual javascript object.
   */
  this.getJSONResult = function (result){
    let nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
      .createInstance(Components.interfaces.nsIJSON);
    return nativeJSON.decode(result);
  };
  
  
  /**
   * From: http://xulsolutions.blogspot.com/search/label/uninstall
   */
  this._uninstall = false;
 
  /**
   * Observer callback. If the user wants to uninstall we delete our preference branch 
   * and remove the login data.
   */
  this.observe = function(subject, topic, data) {
    if (topic == "em-action-requested") {
      subject.QueryInterface(Components.interfaces.nsIUpdateItem);

      if (subject.id == this.MY_EXTENSION_UUID) {
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

	prefs.deleteBranch(this.optprefix);
	this.userPass("", "");
	
      }
      this.unregister();
    }
  };
  
  this.register =  function() {
    var observerService =
      Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);

    observerService.addObserver(this, "em-action-requested", false);
    observerService.addObserver(this, "quit-application-granted", false);
  };
  
  this.unregister = function() {
    var observerService =
      Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);

    observerService.removeObserver(this,"em-action-requested");
    observerService.removeObserver(this,"quit-application-granted");
  };
  
  
  /**
   * Overlay initialisation.
   */
  this.overlayInit = function (event){
      this.register(); 
      this.onloadStatusbar();
  };
}

/*

function testpopup(popup, event){
  
  dump("event.originalTarget.id="+event.originalTarget.id+"\n");
  dump("event.rangeParent.id="+event.rangeParent.id+"\n");
  //for(let k in event) dump("event."+k+"="+event[k]+"\n");
  
}

*/