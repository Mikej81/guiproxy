// -----------------------------------------------------------------------------
// XUI Variables
// -----------------------------------------------------------------------------

var Xui = new Object();				// XUI API object
var xuiHelpWindow = null;			// XUI external help window handle
var xuiUpdateTimer = null;			// XUI update timer handle
var xuiResizeTimer = null;			// XUI resizer timer handle

var alertResponse = null;			// Last updated <alert> response text
var dateandtimeResponse = null;		// Last updated <dateandtime> response text
var deviceidResponse = null;		// Last updated <deviceid> response text
var licenseResponse = null;			// Last updated <license> response text
var advisoryTextResponse = null;	// Last updated <coloradvisory> response text
var advisoryColorResponse = null;	// Last updated <coloradvisory> response color
var loginstatsText = null;			// Coleman Hack beta
var loginstatsUser = null;			// Coleman Hack beta
var partitionResponse = null;		// Last updated <partition> response text
var lastSelectedPartition = null;	// Last selected partition for dictating update of partition selection widget
var statusmenuResponse = null;		// Last updated <statusmenu> response text
var userinfoResponse = null;		// Last updated <userinfo> response text
var userRole = null;
var setmainmenu = false;			// Has a main menu and link been set?
var setpagemenu = false;			// Has the content set the page menu?
var setpagehelp = false;			// Has the content set the help page?
var setpagepanel = false;			// Has the content set a page panel?
var pagepanelispersistent = false;              // Has the content indicated the page panel should be persistent until closed?

var currentMainMenuID = null;		// Last menu section marked by markMainMenu()
var currentMainLinkID = null;		// Last menu link marked by markMainMenu()

var contentLoaded = false;

var trailArray = new Array();		// Array of trail items
var prevTrailArray = new Array();	// For BZ#554691

var bs3Page = null;                 // See Bug 222811

var modalLoadedFunction = null;     // Holds registered function to be called after a modal dialog is loaded.
var partitionUpdateHandler = null;
var folderResponse = null;          // Last updated <folder> response text
var lastProxiedDevice = getCookie("proxied_device");
var renderUpdateRequest = null;

var windowEventsNamespace = '.windowEvents'; // Namespace for event bindings should start with '.' char
var ispbdosLicensed = false;
//-----------------------------------------------------------------------------
//JQuery extensions
//-----------------------------------------------------------------------------
jQuery.fn.extend({
    // From jQuery 1.4.2
    delay: function( time, type ) {
            time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
            type = type || "fx";

            return this.queue( type, function() {
                    var elem = this;
                    setTimeout(function() {
                            jQuery.dequeue( elem, type );
                    }, time );
            });
    }
});




// -----------------------------------------------------------------------------
// Document, Window, and AJAX Events
// -----------------------------------------------------------------------------

jQuery(document).ready(function() {
	// Redirect - Unsupported Browsers (basic checking only)
	if (!document.getElementById || !document.createElement || document.layers) {
		window.location.href = 'common/nosupport.txt';
	}
	// Begin XUI Initilization
	else {
		// Update document title
		document.title = string_productName;

		// Render Logout
		// Add a hidden anchor to prevent the header Referer from missing in IE8
		$('<a id="hiddenLogout" style="display:none"></a>').appendTo($('#logout'));
		$("#hiddenLogout").attr('href', path_logoutPage);
		$('<a href="#">' + string_Logout + '</a>').click(function(){
			delCookie("proxied_device");
			delSession("_TOKEN");
			delSession("_AUTHZ");
			delSession("_TIMESKEW");
			$.ajax({
				async: false,
				cache: false,
				type: "post",
				url: path_logoutPageASM
				});
			stopUpdates();
			//window.top.location.replace won't carry Referer in IE8
			document.getElementById("hiddenLogout").click();
			return false;
		}).appendTo($('#logout'));

		// Render Logo
        var $logoLink = $('<a href="#" title="Click to return to the start page"></a>').click(function() {
            return loadContent(path_startPage ? path_startPage : $('#mainpanel div.module ul a:first').attr('href'));
        });
        if(bigip_herculon_platform_ids.indexOf(bigip_platform_id) >= 0) {
            $logoLink.append('<img src="' + path_imageDirectory + 'logo_f5_new.png" class="png" alt="F5 Logo" />').append('<br>')
                .append('<img src="' + path_imageDirectory + 'logo_f5_herculon_mark.png" class="png" alt="F5 Logo" />');
            $('#logo').empty().css('text-align', 'center').append($logoLink);
        } else {
            $logoLink.append('<img src="' + path_imageDirectory + 'logo_f5.png" class="png" alt="F5 Logo" />')
            $('#logo').empty().append($logoLink);
        }

		 //check for purpose built dos license (to show/hide collapsible main menu)
		//This ajax call will be removed once we have framework support for collapsible
		// main menu for all the modules.
		$.ajax({
			url: path_pbdosCollapsibleMenu,
			success: function (response) {
				if (response !== null) {
					var responseObj = JSON.parse(response);
					if (responseObj && responseObj.value) {
						//Add collapsible panel only for pbdos
						ispbdosLicensed = responseObj.value;
						expandCollapseMainMenu();
					} else {

						ispbdosLicensed = false;
					}
				} else {
					ispbdosLicensed = false;
				}
			},
			error: function () {
				ispbdosLicensed = false;
			}

		});


		// Render panel tabs and containers
		var tabArray = $(['main','help','about']);
		var tabNameArray = $([string_Main,string_Help,string_About]);
		var tabListObj = $('<ul class="containfloat"></ul>').appendTo('#tabs');
		tabArray.each(function(i){
			// Tab markup
			var obj = $('<li id="' + this + 'tab"></li>').appendTo(tabListObj);
			$('<a href="#">' + tabNameArray[i] + '</a>').click(function(){
				showPanel(tabArray[i]);
				return false;
			}).appendTo(obj);
			// Panel markup
			$('<div id="' + this + 'panel" class="panel"></div>').appendTo('#panels');
		});

		// Render Main Panel
		renderMainMenu();
		showPanel('main');

		// Render Help Panel
		var helpOptionsObject = $('<div class="options containfloat"></div>').appendTo('#helppanel');
		$('<a href="#" style="width: 32%;"><span>' + string_Launch + '</span></a>').click(function(){
			var windowHeight = '600';
			var windowWidth = '500';
			try {
				var currentHelpUrl = frames['helpframe'].location.href;
			}
			catch(e) {
				var currentHelpUrl = setpagehelp;
			}
			xuiHelpWindow = openWindow(currentHelpUrl,'f5_help','height=' + windowHeight + ',width=' + windowWidth + ',menubar=0,toolbar=0,location=0,directories=0,personalbar=0,status=0,resizable=1,scrollbars=1');
			showPanel('main');
			return false;
		}).appendTo(helpOptionsObject);
		$('<a href="#" style="width: 32%; margin-left: 2%;"><span>' + string_Print + '</span></a>').click(function(){
			printFrame('helpframe');
			return false;
		}).appendTo(helpOptionsObject);
		$('<a href="#" style="float: right; width: 32%;"><span id="helppanel-expand">' + string_Expand + '</span><span id="helppanel-collapse">' + string_Collapse + '</span></a>').appendTo(helpOptionsObject);
		$("#helppanel-expand").click(function(){
			var helpframeObj = $(frames['helpframe'].document.documentElement);
			helpframeObj.find('dt').addClass('expand').next('dd').slideDown('fast',function(){
				resizeFrameHeight('helpframe');
			});
			$(this).parent().find('span').toggle();
			return false;
		});
		$("#helppanel-collapse").click(function(){
			var helpframeObj = $(frames['helpframe'].document.documentElement);
			helpframeObj.find('dt').removeClass('expand').next('dd').slideUp('fast',function(){
				resizeFrameHeight('helpframe');
			});
			$(this).parent().find('span').toggle();
			return false;
		});
                $('#helppanel').append('<iframe id="helpframe" name="helpframe" src="' + path_blankPage +'" allowtransparency="false" frameborder="no" scrolling="no" onload="resizeFrameHeight(this.name,350);"></iframe>');
		$('#helptab a').click(function() {
			resizeFrameHeight('helpframe',350);
			loadHelp();
			return;
		});

		// Render About Panel
		$('#aboutpanel').append('<iframe id="aboutframe" name="aboutframe" src="' + path_aboutPage +'" allowtransparency="false" frameborder="no" scrolling="no" onload="resizeFrameHeight(this.name,350);"></iframe>');
		$('#abouttab a').click(function() {
			frames['aboutframe'].location.replace(path_aboutPage);
		});

		// Render Wizard Panel
		$('<div id="wizardpanel" class="panel"><div class="options containfloat"></div><iframe id="wizardframe" name="wizardframe" src="' + path_blankPage +'" allowtransparency="false" frameborder="no" scrolling="no" onload="resizeFrameHeight(this.name,350);initPanelLoad();"></iframe></div>').appendTo('#panels');
		frames['wizardframe'].location.replace(path_blankPage);

		// Render Modal containers
		var modalContainer = $('<div id="modal"></div>').appendTo($(document.body));
		$('<div class="overlay"></div>').appendTo(modalContainer);
		var modalPosition = $('<div class="position"></div>').appendTo(modalContainer);
		$('<div id="modalcontent"></div>').appendTo(modalPosition);
		$('<a href="#" onclick="return hideModal();" class="closebutton">' + string_closeModal + '</a>').appendTo(modalPosition);
		$('<iframe src="' + path_blankPage + '" id="modalframe" name="modalframe" frameborder="no" scrolling="auto" onload="initModalContent();"</iframe>').appendTo(modalPosition);
		frames['modalframe'].location.replace(path_blankPage);
		$('<iframe src="' + path_errorModal + '" id="errorframe" name="errorframe" frameborder="no" scrolling="auto"></iframe>').appendTo(modalPosition);

		// Ignore mouse clicks on the modal container.  Set the focus to first visible input/button in the modal
		// iframe or just to the iframe window if no controls are visible.
		$('#modal').click(function(e) {
			if ($('#modalframe').is(':visible')) {
			        e.preventDefault();
			        e.stopPropagation();
				var ctrl = $('#modalframe').contents().find('button,input,a').filter(':visible:first');
				if (ctrl.length) {
					ctrl.focus();
				} else {
					$('#modalframe').get(0).contentWindow.focus();
				}
			} else if ($('#errorframe').is(':visible')) {
			        e.preventDefault();
 			        e.stopPropagation();
				var ctrl = $('#errorframe').contents().find('button,input,a').filter(':visible:first');
				if (ctrl.length) {
					ctrl.focus();
				} else {
					$('#errorframe').get(0).contentWindow.focus();
				}
			} else if ($('#modalcontent').is(':visible')) {
                            //do nothing, let the user click
			} else{
			        e.preventDefault();
 			        e.stopPropagation();
			}

		});

		// Start XUI Updates (alerts, configuation data, status updates)
		startUpdates();

           	// Set up a resize handler for the main frame.
		$(window).resize(function(){
			try{
				// If the content frame has loaded api.js and requested constrained resize handling
				// then force the content iframe to resize to the visible content area.
				if (frames['contentframe'].Xui.requestAvailableContentArea()){
					forceResizeContentToAvailableArea();
				} // else ignore the event and fall through to the default behavior
			} catch(e) { /* Content frame document did not load api.js.  Ignore and fall through to the  default behavior */ }
		});

		//clear session when loading
		delSession("_TOKEN");
		delSession("_AUTHZ");
		delSession("_TIMESKEW");
	}
});

window.onload = function(e) {
    // Check for Firebug add-on (Firefox)
	if (window.console && window.console.firebug) {
		showAlert(string_firebug,'firebug',path_firebugModal,'modal',string_learnmore,true);
	}
};

window.onbeforeunload = function(e) {
	// Stop XUI updates
	stopUpdates();
	// Close help window if open (window handle invalid after refresh)
	if (xuiHelpWindow && !xuiHelpWindow.closed && xuiHelpWindow.location) {
		xuiHelpWindow.close();
	}
	// If the URL does not contain a direct link, store the content frame src
	// for page refresh
	else {
		contentURL = getContentUrl();
		if (isUrlToRememberForRefresh(contentURL)) {
			setCookie('f5_refreshpage',escape(contentURL));
		}
	}
	// INTERNET EXPLORER & JQUERY 1.3.2 BUG FIX:
	// The following code will prevent JavaScript error from being displayed when
	// the XUI is unloaded with Internet Explorer. This is a known jQuery bug (#4820)
	// Ticket URL: http://dev.jquery.com/ticket/4280
	window.onerror = function(e){
		return true;
    };
};

jQuery.ajaxSetup({
	beforeSend: function(requestObj) {
		requestObj.setRequestHeader("F5-Automated-Request", "true");
	}
});

jQuery(document).ajaxSuccess(function(event, responseObj, settings) {
	if (xuiUpdateTimer != -1) { // If we've explicitly stopped the timer, don't execute this block.
		if (responseObj.getResponseHeader("F5-Login-Page")) {
			stopUpdates();
			loadModal(path_credentialsModal,false);
		}
	}
});


// -----------------------------------------------------------------------------
// Updates (alerts, configuration data, and status menu)
// -----------------------------------------------------------------------------

// Stop updates and start it again after a specified amount of time
function delayUpdates(duration) {
    stopUpdates();
    setTimeout(function() { startUpdates(); }, duration);
}

function startUpdates(callbackOnce) {
	stopUpdates();
	xuiUpdateTimer = null;
	renderUpdates(callbackOnce);
}

function stopUpdates() {
	if (renderUpdateRequest != null) {
		renderUpdateRequest.abort();
		renderUpdateRequest = null;
	}
	clearTimeout(xuiUpdateTimer);
	xuiUpdateTimer = -1; // Explicitly stop the timer (not just set it back to null)
}

function renderUpdates(callbackOnce) {
	renderUpdateRequest = jQuery.ajax({
		url: path_updateXML,
		timeout: timeout_status * 1000,
		cache: false,
		success: function(response) {
			if (xuiUpdateTimer != -1) { // If we've explicitly stopped the timer, don't execute this block.

				// HTTP Proxy - confusion may arise if two tabs or two separate windows are open and the user
				// changes the remoting state in one of the windows.  If we detect this case, we'll pop up a
				// modal dialog notifying the user, then do a full page refresh when the user acknowledges
				// the warning.
				var proxiedDevice = getCookie("proxied_device");
				if (lastProxiedDevice != proxiedDevice) {
					loadModal(path_proxyModal, false);
					lastProxiedDevice = proxiedDevice;
					return false;
				}

				// Check <license> element
				var responseText = $(response).find('license:first').attr('value');
				if (responseText) {
					if (licenseResponse == null) {
						licenseResponse = responseText;
					}
					else if (responseText != 'undefined' && responseText != licenseResponse) {
						licenseResponse = responseText;
						loadModal(path_licenseModal, false);
					}
				}
				// Render <coloradvisory> element
				var responseText = Escape.toXmlText($(response).find('coloradvisory').attr('label'));
				var responseColor = $(response).find('coloradvisory').attr('color');
				var cssColor = '#f00';

				// Tweak the color code
				if (responseColor == 'red') {
					cssColor = '#f00';
				} else if (responseColor == 'orange') {
					cssColor = '#f80';
				} else if (responseColor == 'green') {
					cssColor = '#6a0';
				} else if (responseColor == 'blue') {
					cssColor = '#30f';
				}

				if (responseColor) {
					if ((responseText != advisoryTextResponse) || (responseColor != advisoryColorResponse)) {
						advisoryTextResponse = responseText;
						advisoryColorResponse = responseColor;
						if ($('#advisoryhead').size() == 1) {
							$('#advisoryhead').html(responseText);
							$('#advisoryhead').css({'background-color' : cssColor, 'border-left-color' : cssColor, 'border-right-color' : cssColor});
							$('#advisoryfoot').html(responseText);
							$('#advisoryfoot').css('background-color', cssColor);
						}
						else {
							var headerObject = $('#header');
							var headerHtml = '<div id="advisoryhead">' + responseText + '</div>';
							headerObject.prepend(headerHtml);
							$('#advisoryhead').css({'background-color' : cssColor, 'border-left-color' : cssColor, 'border-right-color' : cssColor});
							var footerObject = $('#footer');
							var footerHtml = '<div id="advisoryfoot">' + responseText + '</div>';
							footerObject.append(footerHtml);
							$('#advisoryfoot').css('background-color', cssColor);
						}
					}
				}
				else {
					advisoryTextResponse = null;
					advisoryColorResponse = null;
					$('#advisoryhead').remove();
					$('#advisoryfoot').remove();
				}
				//Render Login Stats Element
				var statsText = Escape.toXmlText($(response).find('loginstats').attr('label'));
				var statsUser = $(response).find('loginstats').attr('user');

				if ((statsText != loginstatsText) || (statsUser != loginstatsUser)) {
					var headerObject = $('#header');
					var loginStatsHtml = '<div id="loginstatshead" style="containfloat">' + loginstatsUser + '</div>';
					headerObject.append(loginStatsHtml);
				}

				// Render <deviceid>, <dateandtime>, and <userinfo> elements
				var title = string_productName;
				var deviceId1 = $(response).find('deviceid:first').attr('value');
				var deviceId2 = $(response).find('deviceid:last').attr('value');
				if (deviceId1 && deviceId1 != undefined) {
					title += ' - ' + Escape.fromXmlAttribute(deviceId1);
				}
				var proxiedDevice = getCookie('proxied_device');
				if (proxiedDevice != null && proxiedDevice.length > 0) {
					deviceId2 = proxiedDevice;
				}
				if (deviceId2 && deviceId2 != undefined && deviceId1 != deviceId2) {
					title += ' (' + deviceId2 + ')';
				}
				if (document.title != title) {
					document.title = title;
				}
				var tagArray = $(['deviceid','dateandtime','userinfo']);
				var keyArray = $(['deviceidResponse','dateandtimeResponse','userinfoResponse']);
				var pathArray = $([path_deviceidPage,path_dateandtimePage,path_userinfoPage]);
				tagArray.each(function(i){
					// Create new response key
                    responseText = '';
                    $(response).find(tagArray[i]).each(function(){
                        responseText += removeNonAlphaNumeric($(this).attr('value'));
                    });
                    if (tagArray[i] == 'userinfo') {
                        $(response).find(tagArray[i]).each(function() {
                            if ($(this).attr('label') == 'Role:')
                                userRole = $(this).attr('value');
                        });
                    };
                    // Compare new response key to previous response key and update content if appropriate
                    if (responseText != '' && responseText != eval(keyArray[i])) {
						eval(keyArray[i] + ' = responseText');
						var containerObject = $('#' + tagArray[i]).empty();
						// If tag does not contain a path attribute, use path defined in variables.js
						if (!$(response).find(tagArray[i] + ':first').attr('path') && pathArray[i] != null) {
							if (tagArray[i] == 'userinfo') {
								pathArray[i] += $(response).find('userinfo:first').attr('value');
							}
							$(response).find(tagArray[i] + ':first').attr('path', pathArray[i]);
						}
						$(response).find(tagArray[i]).each(function() {
							var html = '<div style="containfloat"><label>' + $(this).attr('label') + '</label>';
							if ($(this).attr('path')) {
								html += '<a href="' + $(this).attr('path') + '"';
								if ($(this).attr('details')) {
									html += ' title="' + $(this).attr('details') + '"';
								}
								html += ' target="contentframe">' + $(this).attr('value') + '</a>';
							}
							else {
								if ($(this).attr('details')) {
									html += '<span title="' + $(this).attr('details') + '">';
								}
								// Special case for HTTP proxy and IP address of remote device
								if (tagArray[i] == 'deviceid' && $(this).attr('label') == 'IP Address:') {
									if (proxiedDevice != null && proxiedDevice.length > 0) {
										html += proxiedDevice;
									} else {
										html += $(this).attr('value');
									}
								} else {
									html += $(this).attr('value');
								}
								if ($(this).attr('details')) {
									html += '</span>';
								}
							}
							html += '</div>';
							containerObject.append(html);
						});
					}
				});
				// Render <partition> elements
				responseText = '';
				$(response).find('partition').each(function(){
					responseText += removeNonAlphaNumeric($(this).attr('value'));
				});


				var currentPartitionValue = getCookie('F5_CURRENT_PARTITION');
				var partitionSelectionChanged = (currentPartitionValue !== null && currentPartitionValue !== lastSelectedPartition);
				//partition selection should only "change" without user interaction at login, when the selection is first set.
				var isPartitionDisabled = Xui.isPartitionDisabled();

				if ( responseText != '' && ( responseText != partitionResponse ||  partitionSelectionChanged ) ) {
					partitionResponse = responseText;
					lastSelectedPartition = currentPartitionValue;
					var partitionObj = $('#partition').empty();
					$('<label>Partition: </label>').appendTo(partitionObj);
					// If only one partition is given, display as text
					if ($(response).find('partition').length == 1) {
						$('<span>' + $(response).find('partition:first').attr('label') + '</span>').appendTo(partitionObj);
					}
					// If more than one partition is given, display as select box
					else {
						//Assign anonymous function to partition select that fires when a user changes the partition selection
						var partitionSelectObj = $('<select id="partition_control"></select>').change(function(){
						    	var currentPartition = $(this).attr('value');
					 		setCookie('F5_CURRENT_PARTITION', currentPartition);
							//force update so the user will not see delay in updating role on partition change
							startUpdates(function() {
								if (partitionUpdateHandler) {
									partitionUpdateHandler();
								}
							});
							//reload content frame
							loadContent(getContentUrl());
							//refresh the main menu, in case the user's role changes when changing partitions.
							renderMainMenu();
						}).appendTo(partitionObj);
						if(partitionSelectionChanged == true && isPartitionDisabled){
							partitionSelectObj.attr("disabled","disabled");
						}

						if (!currentPartitionValue) {
							currentPartitionValue = $(response).find('partition:first').attr('value');
							setCookie('F5_CURRENT_PARTITION', currentPartitionValue);
						}
						$(response).find('partition').each(function() {
							var selectedAttr = $(this).attr('value') == currentPartitionValue ? ' selected="true"' : '';
							$('<option value="' + $(this).attr('value') + '"' + selectedAttr + '">' + $(this).attr('label') + '</option>').appendTo(partitionSelectObj);
						});
					}
					//reset tracking variable back to false
					partitionSelectionChanged = false;
				}
				// Render <alert> elements
				responseText = '';
				$(response).find('alert').each(function(){
					responseText += removeNonAlphaNumeric($(this).attr('label'));
				});
				if (responseText != alertResponse) {
					alertResponse = responseText;
					$('#alert-list li.system').remove();
					var alertArray = $(response).find('alert');
					if (alertArray.length > 0) {
						alertArray.each(function(){
							var alertText = $(this).attr('label');
							var alertID = $(this).attr('id') ? $(this).attr('id') : '';
							var alertPath = $(this).attr('path') ? $(this).attr('path') : '';
							var alertClass = $(this).attr('class') ? 'system ' + $(this).attr('class') : 'system';
							var alertDetails = $(this).attr('details') ? $(this).attr('details') : '';
							showAlert(alertText,alertID,alertPath,alertClass,alertDetails,false);
						});
					}
					else {
						if ($('#alert-list li').length == 0) {
							hideAlert();
						}
					}
				}

				// Hide/Show Log out button (as determined by xuistatus.jsp)
				$(response).find('logout_button').each(function() {
					if ($(this).attr('show') == 'false')
						$('#logout').hide();
					else
						$('#logout').show();
				});

				// Render <statusitem> elements
				responseText = '';
				$(response).find('statusitem').each(function(){
					$.each(this.attributes, function(i, attrib) {
						responseText += removeNonAlphaNumeric(attrib.value);
					});
				});
				if (responseText != statusmenuResponse && responseText != null) {
					statusmenuResponse = responseText;
					var statusmenuObj = $('#status').empty();
					$(response).find('statusitem').each(function() {
						var obj = $('<div></div>').attr({
							id: $(this).attr('id') ? 'alert-' + $(this).attr('id') : '',
							className: $(this).attr('class') ? $(this).attr('class') : 'none',
							title: $(this).attr('details') ? $(this).attr('details') : ''
						}).appendTo(statusmenuObj);
						if ($(this).attr('path')) {
							if ($(this).attr('target')) {
								$(['<a target="', $(this).attr('target'), '" href="', $(this).attr('path'), '">', $(this).attr('label'), '</a>'].join('')).appendTo(obj);
							} else {
								$('<a href="' + $(this).attr('path') +'">' + $(this).attr('label') + '</a>').click(function(){
								if ($(this).attr('href') != '#') loadContent($(this).attr('href'));
								return false;
								}).appendTo(obj);
							}
						} else {
							obj.html($(this).attr('label'));
						}

						// secondaryPath and secondaryLable are optional. If they are passed, a second link in parenthesis is constructed.
						if ($(this).attr('secondaryPath')) {
							$('<span> (</span>').appendTo(obj);
							$('<a href="' + $(this).attr('secondaryPath') +'">' + $(this).attr('secondaryLabel') + '</a>').click(function(){
								if ($(this).attr('href') != '#') loadContent($(this).attr('href'));
								return false;
							}).appendTo(obj);
							$('<span>)</span>').appendTo(obj);
						}
					});
				}
				// Clear Timer just in case. This prevents running multiple instances.
				clearTimeout(xuiUpdateTimer);

				// Reset Timer
				xuiUpdateTimer = setTimeout(function(){renderUpdates(null)},time_updateXui * 1000);
			}
		},
		error: function() {
			if ($('#modal').css('display') == 'none') {
				ie6ModalFixToggle();
				$('#modal').show();
			}
			dismissModal(false);
			$('#modalcontent, #modalframe').hide();
			$('#errorframe').show();
            var proxiedDevice = getCookie('proxied_device');
			frames['errorframe'].window.init(proxiedDevice != null && proxiedDevice.length > 0);
			$(document.getElementById('errorframe').contentWindow.document).keydown(function(e) {
				if (e.keyCode == 9) {
					e.preventDefault();
					e.stopPropagation();
					$(this).contents().find('button,input').filter(':visible:first').focus();
				}
			});
		},
        complete: function() {
            renderUpdateRequest = null;
            if (callbackOnce) {
                callbackOnce();
            }
        }

	});
}

function getUserRole() {
    return userRole;
}

// -----------------------------------------------------------------------------
// Main Menu & Page Menu Functions
// -----------------------------------------------------------------------------

function renderMainMenu(mainMenuID, mainLinkID, divtargetid, callback) {
	if (!divtargetid) divtargetid = "mainpanel";
	jQuery.ajax({
		url: path_mainMenuXML,
		cache: false,
		success: function(response) {
			var menuPanelObj = $('#'+divtargetid).empty();
			if (getCookie('f5_compactmenu') != 'false') {
				menuPanelObj.addClass('compact');
			}
			// Render <mainmenu> elements
			$(response).find('mainmenu').each(function() {
				var menuID = $(this).attr('id') ? $(this).attr('id') : removeWhiteSpace($(this).attr('label')).toLowerCase();
				var menuObj = $('<div id="mainmenu-' + menuID + '" class="module containfloat"></div>').appendTo(menuPanelObj);
				var menuIcon = $('<img src="' + $(this).attr('icon') + '" class="icon png" />').appendTo(menuObj);
				var menuSmallIcon = $('<img src="' + $(this).attr('smallicon') + '" class="smallicon png" />').appendTo(menuObj);
				var menuLabel = $('<a href="#" class="label" title="' + $(this).attr('description') + '">' + $(this).attr('label') + '</a>').appendTo(menuObj);
				var menuDescriptionObj = $('<p class="description">' + $(this).attr('description') + '</p>').appendTo(menuObj);
				$([menuIcon,menuSmallIcon,menuLabel,menuDescriptionObj]).each(function(){
					$(this).click(function(){
						menuObj.toggleClass('open');
						if (getCookie('f5_autoclose') != 'false') {
							$('#'+divtargetid+' .module.open:not(#' + menuObj.attr('id') + ')').each(function(){
								$(this).removeClass('open');
							});
						}
						// Opening/closing mainmenu sections can change the content size.  Adjust.
						$(window).trigger('resize');
						return false;
					});
				});
				// Convert XML structure to nested <ul> elements and append to menu panel
				renderMenuItems($(this).children(),menuObj,menuObj.attr('id') + '-');
			});
			// Adjust the links for subject menus
			$('#'+divtargetid+' ul.inactivecontextmenu a').each(function(){
				$(this).attr({ 'orighref' : $(this).attr('href') });
				$(this).attr({ 'href' : '#' });
			});
			// Attach class to root <ul> items
			$('#'+divtargetid+' div.module > ul').addClass('root').children('li').addClass('root');
			// Attach click event to links
			$('#'+divtargetid+' a:not([href$="#"], #mainpanel a[orighref])').each(function(){
				$(this).click(function(){
					scrollToTop();
					var id = $(this).parents('li:first').attr('id');
					if (id){
					var mainMenuID = id.split('-')[1];
					var mainLinkID = id.split(mainMenuID + '-')[1];
					markMainMenu(mainMenuID,mainLinkID);
					}
					if ($(this).parent().hasClass('window')) {
						openWindow($(this).attr('href'),$(this).attr('target'),$(this).attr('features'));
					}
					else {
						loadContent($(this).attr('href'));
					}
					return false;
				});
			});
			// Apply fix for IE6 hover-over-<select> bug
			if ($.browser.msie && $.browser.version == 6) {
				ie6SelectFix($('#'+divtargetid+' ul.root > li > ul'));
			}
			// Render content frame if necessary (initial XUI load)
			if ($('#contentframe').length == 0) {
				renderContent();
			}
			// If content already exists, mark the main menu (must be an update)
			else {
				markMainMenu(currentMainMenuID,currentMainLinkID,true);
				// Page trail depends on main menu, so it needs to be updated
				renderPageTrail();
                                if (prevTrailArray.length > 0) {//BZ554691
                                    Xui.setPageTrail.apply(Xui, prevTrailArray);
                                    appendPageTrail();
                                }
			}
			if (callback) callback();

			if (getCookie('proxied_device') != null) {
				$("#mainpanel").addClass("remote").prepend("<div class='options containfloat' style='padding-bottom: 12px;'><a class='exit' onclick='Xui.local();'><span>Exit Remote System</span></a></div>");
			}


			//expand/collapse main menu for pbdos
			expandCollapseMainMenu();
		}
	});
	return false;
}


//expand/collapse main menu
function expandCollapseMainMenu() {
	//expand/collapsible mainmenu when the feature flag mod_dos
	//(for pbdos) is turned on
	if (ispbdosLicensed) {
		Xui.addCollapsibleMainMenu();
	} else {
		Xui.removeCollapsibleMainMenu();
	}

}

function markMainMenu(mainMenuID,mainLinkID,forceMarkTrueFalse, contextName, contextParams) {
	jQuery(function() {
		if(contextParams){
			contextParams=contextParams.replace(/&amp;/g, '&');
		}
		if (mainMenuID && mainLinkID) {
			// Open the main menu section
			if (mainMenuID != currentMainMenuID || forceMarkTrueFalse == true) {
				$('div[id|="mainmenu"]').removeClass('current').removeClass('open');
				$('#mainmenu-' + mainMenuID).addClass('current').addClass('open');
			}
			// Mark the main menu link
			if ((mainMenuID + '-' + mainLinkID != currentMainMenuID + '-' + currentMainLinkID) || forceMarkTrueFalse == true) {
				// Clear any currently hilighted menu items and deactivate any open context menus
				$('#mainpanel li.current').each(function(){
					$(this).removeClass('current');
				});
				var contextMenuItem = $('#mainpanel li.activecontextmenu')[0];
				if(contextMenuItem){
					$(contextMenuItem).find('a').each(function(){
						$(this).attr( { 'href' : '#' } );
					});
					$(contextMenuItem).find('li.iscontextmenu > a').each(function(){
						$(this).text('none');
					});
					$(contextMenuItem).removeClass('activecontextmenu').addClass('inactivecontextmenu');
					$(contextMenuItem).parents('ul.activecontextmenu').each(function(){
						$(this).removeClass('activecontextmenu').addClass('inactivecontextmenu');
					});
				}

				// Hilight the given menu.  If the requested menu item is in a context menu then activate it
				contextMenuItem = $('#mainmenu-' + mainMenuID).find('li[id$="-' + mainLinkID + '"]:last');
				if(contextMenuItem){
					$(contextMenuItem).addClass('current');
					$(contextMenuItem).parents('#mainpanel li').each(function(){
						$(this).addClass('current');
					});
					$(contextMenuItem).parents('#mainpanel li.inactivecontextmenu').each(function(){
						$(this).removeClass('inactivecontextmenu').addClass('activecontextmenu');
					});
					var contextMenuRoot=$(contextMenuItem).parents('li.iscontextmenu:first')[0];
					if (contextMenuRoot){
						$(contextMenuRoot).find('a').each(function(){
							var h = $(this).attr('orighref');
							if (h=='#'){
								return;
							}
							var separator = h.indexOf('?')<0 ? '?' : '&';
							$(this).attr( { 'href' : h+separator+contextParams } );
						});
						$(contextMenuRoot).find('a:first').each(function(){
							$(this).text(contextName);
						});
                                                if ($(contextMenuItem).hasClass('autopagemenu')){
							$(contextMenuRoot).each(function(){

								// If we activated a context menu, then build a pagemenu from its items
						        	var pageMenuItems=[];
								$(this).find('ul:first').children('li').each(function(){
									pageMenuItems.push(buildPageMenuFromMainMenu(this));
								});
							        Xui.setPageMenu(new Xui.PageMenu(pageMenuItems));
							});
						} else {
							/*
                                                         * this is commented out to remove the "flash" between then the
                                                         * old page menu is unloaded and the new page menu is loaded
                                                         * Downside is that pages that do not specify a page menu and
							 * do not autogenerate a page menu will have the pagemenu from
							 * the previous page still in place
                                                         */
							//Xui.setPageMenu();
						}
					} else {
                                                if ($(contextMenuItem).hasClass('autopagemenu')){
							$(contextMenuItem).parents('li.root.current').each(function(){
					        		var pageMenuItems=[];
								$(this).find('ul:first').children('li').each(function(){
									pageMenuItems.push(buildPageMenuFromMainMenu(this));
								});
							        Xui.setPageMenu(new Xui.PageMenu(pageMenuItems));
							});
						} else {
							/*
                                                         * this is commented out to remove the "flash" between then the
                                                         * old page menu is unloaded and the new page menu is loaded
                                                         * Downside is that pages that do not specify a page menu and
							 * do not autogenerate a page menu will have the pagemenu from
							 * the previous page still in place
                                                         */
							//Xui.setPageMenu();
						}
					}
				}
			}
			currentMainMenuID = mainMenuID;
			currentMainLinkID = mainLinkID;
		}
	});
	return false;
}

function buildPageMenuFromMainMenu(listItem){
	if( $(listItem).hasClass('hasmenu')){
		var items = [];
		$(listItem).children('ul').each( function(){
			$(this).children('li').each(function(){
				items.push(buildPageMenuFromMainMenu(this));
			});
		});
		return new Xui.PageMenu.DropMenu( $(listItem).children('a:first').text(), items);
	} else {
		var a = $(listItem).children('a')[0];
		return new Xui.PageMenu.Link( $(a).text(), $(a).attr('href'), $(a).parent().hasClass('current')?'current' : '');
	}
}

function renderPageMenu(contentHREF,responseXML,optionalLinkID) {
	jQuery(function() {
		// Create new page menu container
		var pageMenuObject = $('<div id="pagemenu"></div>');
		// Check content paths
		$(responseXML).contents().find('[path]').each(function(){
			$(this).attr('path',checkContentPath($(this).attr('path')));
		});
	 	// Convert XML structure to nested <ul> elements and append to menu container
		renderMenuItems($(responseXML).children('pagemenu').children(),pageMenuObject,'pagemenu-');
		// Attach class to root <ul> items
		pageMenuObject.children('ul').addClass('root').children('li').addClass('root').children('a').addClass('root');
		// Attach click event to links
		pageMenuObject.find('a:not([href$="#"]),a[onclick]').each(function(){
			$(this).click(function(){
				$('#pagemenu .current').removeClass('current');
				$(this).addClass('current').parents('li').addClass('current');
				if ($(this).parent().hasClass('window')) {
					openWindow($(this).attr('href'),$(this).attr('target'),$(this).attr('features'));
				}
				else if (!$(this).attr('onclick')){
					loadContent($(this).attr('href'));
				}
				return false;
			});
		});

		// pageMenuObject.find('a[href="#"]').each(function(){
		// 	$(this).click(function(){
		// 		return false;
		// 	});
		// });
		// Replace old pagemenu object with the new one
		$('#pagemenu').remove();
		pageMenuObject.prependTo('#content');
		// Apply fix for IE6 hover-over-<select> bug
		if ($.browser.msie && $.browser.version == 6) {
			ie6SelectFix($('#pagemenu li.hasmenu'));
		}
		// If an ID is specified, mark the appropriate page menu link and parent elements
		if (optionalLinkID) {
			pageMenuObject.find('#pagemenu-' + optionalLinkID).addClass('current').parents('li').addClass('current');
		}
		// If a page menu item has already been marked as "current", mark the parents as well
		else if ($('#pagemenu .current').length > 0) {
			pageMenuObject.find('.current:last').parents('li').addClass('current');
		}
		// If an ID has not been specified or a link was not given a class of "current" in the page menu
		// object or XML passed to the function, try to determine the current link by matching the link
		// href with the content frame href.
		else {
			pageMenuObject.find('a:not([href$="#"])').each(function(i) {
				if (contentHREF.indexOf($(this).attr('href')) != -1) {
					$(this).addClass('current').parents('li').addClass('current');
					return false;
				}
			});
		}
		// Add options menu
		renderOptionsMenu($(pageMenuObject));
	});
	return false;
}

function renderMenuItems(nodeArray,targetObj,idPrefix) {
	// This function creates nested <ul> elements from an XML response
	jQuery(function(){

		var timeoutOpened={};

		function clearMenuItems(eleId){
			var ele = $('#'+eleId);
			$('ul:first', ele).attr('style', 'display: none');
			ele.css('z-index','');
			var parents = ele.parents();
			var pageMenu = $('#pagemenu');
			if($.inArray(pageMenu[0],parents)==-1){
				$('ul:first',ele).css('top',-1);
			}
			delete timeoutOpened[eleId];
		}

		var startObj = $('<ul></ul>').appendTo(targetObj);
		$(nodeArray).each(function(i){
			var nodeID = $(this).attr('id') ? idPrefix + $(this).attr('id') : removeWhiteSpace(idPrefix + $(this).attr('label')).toLowerCase();
			var nodeClass = $(this).attr('class') ? ' class="' + $(this).attr('class') + '"' : '';
			var itemObj = $('<li id="' + nodeID + '"' + nodeClass + '></li>').hover(
				function () {
					$(this).css('z-index','14');
					var thisEle = this;
					$.each(timeoutOpened, function(openedElementId, openedElementUl) {
						openedElementUl.stop(true);
						if (openedElementId != thisEle.id && $('li#'+openedElementId, thisEle).length==0 && $(thisEle).parents('li#'+openedElementId).length==0) {
							openedElementUl.hide();
							clearMenuItems(openedElementId);
						}
					});

					if ($(this).hasClass('hasmenu')) {
						timeoutOpened[this.id] = $(this).children('ul:not(.inactivecontextmenu,.invisible):first');
						timeoutOpened[this.id].stop(true).show();

						var t = $('ul:first',this).offset();
						var p = $('ul:first',this).position();

						$('#panels',window.document).css('z-index', 14);

						var heightNeeded = t.top + p.top + $('ul:first',this).height();
						var heightAvailable = $(window).height() + $(window).scrollTop();

						var parents = $(this).parents();
						var pageMenu = $('#pagemenu');

						if(heightNeeded > heightAvailable && $.inArray(pageMenu[0],parents)==-1){
							var elementHeight = $('ul:first', this).height();

							var elementCurrentTopPosition = $(this).offset().top-1;

							var winScrollTop = $(window).scrollTop();

							var windowHeight = $(window).height();

							var newTop = windowHeight + winScrollTop - (elementCurrentTopPosition + elementHeight)-25;

							$('ul:first',this).css('top',newTop);
						}
					}
				},
				function () {
					if (timeoutOpened[this.id]) {
						if(getCookie('f5_closedelay') != 'false'){
							timeoutOpened[this.id].delay(300).hide(1);
							timeoutOpened[this.id].queue(function(){
								$(this).hide();
								clearMenuItems(this.parentNode.id);
							});
						} else {
							timeoutOpened[this.id].hide();
							clearMenuItems(this.parentNode.id);
						}
					}

				}
			).appendTo(startObj);
                        if ($(this).attr("pagemenu")=='auto'){
                                itemObj.addClass("autopagemenu");
                        }
			// Path

   			var linkObj;
			if ($(this).attr('path') != undefined && $(this).attr('path') != '#') {
                if ($(this).attr('path').toLowerCase().indexOf("javascript:") == 0) {
                    linkObj = $('<a href="#" onClick="' + $(this).attr('path').substring("javascript:".length) + '">' + $(this).attr('label') + '</a>').appendTo(itemObj);
                }
                else {
				    linkObj = $('<a href="' + $(this).attr('path') + '">' + $(this).attr('label') + '</a>').appendTo(itemObj);
                }

				if ($(this).attr('class') == 'window') {
					var windowTarget = $(this).attr('target') ? $(this).attr('target') : removeNonAlpha(idPrefix).toLowerCase();
					var windowFeatures = $(this).attr('features') ? $(this).attr('features') : '';
					linkObj.attr('target',windowTarget);
					linkObj.attr('features',windowFeatures);
				}
            }
			else {
				var linkObj = $('<a href="#">' + $(this).attr('label') + '</a>').click(function(){
					return false;
				}).appendTo(itemObj);
			}
			// Create Path
			if ($(this).attr('createpath') != undefined) {
				itemObj.addClass('hascreate');
                if ($(this).attr('createpath').toLowerCase().indexOf("javascript:") == 0) {
    				$('<a class="create" href="#" onClick="' + $(this).attr('createpath').substring("javascript:".length) + '" title="' + $(this).attr('label') + '"></a>').appendTo(itemObj);
                }
                else {
    				$('<a class="create" href="' + $(this).attr('createpath') + '" title="' + $(this).attr('label') + '"></a>').appendTo(itemObj);
                }
			}
            // Add Class to the menu item (LI)
            if($(this).children('contextmenu').length > 0){
                itemObj.addClass('hascontextmenu');
            } else if($(this).children('link:not([hidden="true"])').length > 0){
				itemObj.addClass('hasmenu');
            }
            // Add class to the menu container (UL) for context menus
            if (this.tagName=='contextmenu'){
				itemObj.addClass('iscontextmenu');
				itemObj.addClass('inactivecontextmenu');
				startObj.addClass('inactivecontextmenu');
            }
			if($(this).attr('hidden')!=undefined && $(this).attr('hidden')=='true'){
				startObj.addClass('invisible');
			}
            // Add class to the link in the menu item
            if($(this).children().length > 0){
				linkObj.addClass('menu');
				renderMenuItems($(this).children(),itemObj,nodeID + '-');
			}
		});
	});
	return false;
}

function renderOptionsMenu(targetObj) {
	var pageMenuListObj = $(targetObj).find('ul:first');
	var optionsObj = $('<li id="pagemenu-options" class="options"><a href="#" class="options">Options</a></li>').hover(
		function () {
			$(this).css('z-index','2');
			$(this).children('ul:first').show();
		},
		function () {
			$(this).css('z-index','');
			$(this).children('ul:first').hide();
		}
	).prependTo(pageMenuListObj);
	var optionsListObject = $('<ul></ul>').appendTo(optionsObj);
	// Get content title and url (used for "Bookmark / Add to Favorites" and "Direct Link")
	try {
		var url = frames['contentframe'].location.href;
	}
	catch(e) {
		$('#contentframe').attr('src');
	}
	var title = document.title;
	var mainTitle = $('#mainpanel li.current:last a').text();
	var pageTitle = $('#pagemenu li.current:last a').text();
	if (mainTitle) {
		title += ' - ' + mainTitle;
	}
	if (pageTitle) {
		title += ' - ' + pageTitle;
	}
	// Show compact menus by default unless changed by user.
	var compactMenuObjClass = (getCookie('f5_compactmenu') != 'false') ? 'enabled' : 'disabled';
	var compactMenuObj = $('<li class="' + compactMenuObjClass + '"></li>').append(
		$('<a href="#">' + string_showCompactMenus + '</a>').click(function(){
			if ($(this).parent().hasClass('enabled')) {
				$(this).parent().attr('class','disabled');
				$('#mainpanel').removeClass('compact');
                setCookie('f5_compactmenu','false',365);
			}
			else {
				$(this).parent().attr('class','enabled');
				$('#mainpanel').addClass('compact');
                delCookie('f5_compactmenu');
			}
			return false;
		})
	).appendTo(optionsListObject);
	// Auto-close menu sections by default.
	var autocloseObjClass = (getCookie('f5_autoclose') != 'false') ? 'enabled' : 'disabled';
	var autocloseObj = $('<li class="' + autocloseObjClass + '"></li>').append(
		$('<a href="#">' + string_autoCloseMenus + '</a>').click(function(){
			if ($(this).parent().hasClass('enabled')) {
				$(this).parent().attr('class','disabled');
                setCookie('f5_autoclose','false',365);
			}
			else {
				$(this).parent().attr('class','enabled');
                delCookie('f5_autoclose');
			}
			return false;
		})
	).appendTo(optionsListObject);
	var closeDelayObjClass = (getCookie('f5_closedelay') != 'false') ? 'enabled' : 'disabled';
	var closeDelayObj = $('<li class="' + closeDelayObjClass + '"></li>').append(
		$('<a href="#">' + string_menuCloseDelay + '</a>').click(function(){
			if ($(this).parent().hasClass('enabled')) {
				$(this).parent().attr('class','disabled');
				setCookie('f5_closedelay','false',365);

			}
			else {
				$(this).parent().attr('class','enabled');
				delCookie('f5_closedelay');
			}
			return false;
		})
	).appendTo(optionsListObject);
	// Bookmark - Mozilla Firefox < 23
	if (window.sidebar && (typeof window.sidebar.addPanel !== 'undefined')) {
		var linkObj = $('<a href="#">' + string_bookmarkThisPage + '</a>').click(function(){
            if (null != bs3Page) {
                url = bs3Page;
            }
			addBookmark(url,title);
			return false;
		});
	}
	// Add to Favorites - IE
	else if (window.external && (typeof window.external.AddFavorite !== 'undefined')) {
		var linkObj = $('<a href="#">' + string_addToFavorites + '</a>').click(function(){
            if (null != bs3Page) {
                url = bs3Page;
            }
			addBookmark(url,title);
			return false;
		});
	}
	// Bookmark - other browsers (Opera, Safari, etc.)
	else {
		var linkObj = $('<a href="#">' + string_bookmarkThisPage + '</a>').click(function(){
            if (null != bs3Page) {
                url = bs3Page;
            }
                        loadDirectLinkBookmarkModal(url, title);
			return false;
		});
	}
	$('<li></li>').append(linkObj).appendTo(optionsListObject);
	// Direct link to page
	$('<li></li>').append(
		$('<a href="#">' + string_directLinkToPage + '</a>').click(function(){
            if (null != bs3Page) {
                url = bs3Page;
            }
                        loadDirectLinkBookmarkModal(url, title);
                        return false;
		})
	).appendTo(optionsListObject);
	// Print content area
	$('<li></li>').append(
		$('<a href="#">' + string_printContentArea + '</a>').click(function(){
			printFrame('contentframe');
			return false;
		})
	).appendTo(optionsListObject);
}

function ie6SelectFix(nodeArray) {
	jQuery(function(){
		$(nodeArray).each(function() {
			$(this).hover(
				function () {
					try {
						var contentBodyObj = frames['contentframe'].window.document.body;
						if (contentBodyObj.className.indexOf('hideselect') == -1) {
							contentBodyObj.className += ' hideselect';
						}
					}
					catch(e) {};
				},
				function () {
					try {
						var contentBodyObj = frames['contentframe'].window.document.body;
						contentBodyObj.className = contentBodyObj.className.replace(/\shideselect/g,'');
					}
					catch(e) {};
				}
			);
		});
	});
}

// Put up a modal allowing url to be linked or bookmarked as title.
function loadDirectLinkBookmarkModal(url, title) {

   // Define a function to be executed when the modal has been loaded.
   modalLoadedFunction = function() {

      var modalFrame = document.getElementById('modalframe');
      var modalDocument = modalFrame.contentDocument;
      var linkObj = modalDocument.getElementById('link');

      if (null != linkObj) {
         // Dynamically insert the hyperlink to url.
         linkObj.setAttribute('href', url);
         linkObj.innerHTML = url;

         // Dynamically insert the bookmark onClick functions.
         var bookmarkHandlerFunction = function() {
             addBookmark(url, title);
             return false;
         }
         $('#bookmark-mozilla-link', modalDocument).click(bookmarkHandlerFunction);
         $('#bookmark-ie-link', modalDocument).click(bookmarkHandlerFunction);
		 linkObj.focus();
      }
   };

   // Load a modal content page. This is an asynchronous call.
   loadModal(path_linkModal);

}

// -----------------------------------------------------------------------------
// Trail Functions
// -----------------------------------------------------------------------------

function renderPageTrail() {
	jQuery(function() {
		var mainMenuObj = $('#mainpanel div.current:first a.label');
		var mainLinkObj = $('#mainpanel li.current:not(.hascontextmenu li):last a:first');
		var mainLinkArray = $('#mainpanel li.current:not(.hascontextmenu li)');
		var contextLinkObj = $('#mainpanel li.current.hascontextmenu li.current:last a:first');
		var contextLinkMenuObj = $('#mainpanel li.current.hascontextmenu li.current.iscontextmenu');
		var contextLinkArray = $('#mainpanel li.current.hascontextmenu li.current:not(.iscontextmenu)');
		var trailObject = $('#trail').empty();
		var mainSeparatorText = '&nbsp;&nbsp;&#8250;&#8250;&nbsp;&nbsp;';
		var subSeparatorText = '&nbsp;:&nbsp;';
		// The first trail item is the title of the current main menu section
		if (mainMenuObj.length > 0) {
			$('<a href="#">' + mainMenuObj.text() +'</a>').click(function(){
				$('#mainpanel div.module:not(.current)').removeClass('open');
				$('#mainpanel div.current:first').addClass('open');
				return false;
			}).appendTo(trailObject);
		}
		// The second trail item is the text and href of the currently marked main menu link
		if (mainLinkObj.length > 0) {
			var mainLinkText = '';
			mainLinkArray.each(function(i) {
				mainLinkText += $(this).find('a:first').text();
				if (i != mainLinkArray.length - 1) {
					mainLinkText += subSeparatorText;
				}
			});
    		$('<span>' + mainSeparatorText + '<a href="' + mainLinkObj.attr('href') + '">' + mainLinkText + '</a></span>').click(function(){
	    		loadContent(mainLinkObj.attr('href'));
		    	return false;
			}).appendTo(trailObject);
		}
		// The third trail item is the text (no href) of the currently marked context menu link
		if (contextLinkObj.length > 0) {
			var contextLinkText = '';
			contextLinkArray.each(function(i) {
				contextLinkText += $(this).find('a:first').text();
				if (i != contextLinkArray.length - 1) {
					contextLinkText += subSeparatorText;
				}
			});
			contextLinkText += subSeparatorText + contextLinkMenuObj.find('a:first').text();
			$('<span>' + mainSeparatorText + contextLinkText +'</span>').appendTo(trailObject);
		}
		if (trailArray.length == 0) {
			$('#trail :last').addClass('current');
		} else {
			appendPageTrail();
		}
	});
	return false;
}

function appendPageTrail() {
    var trailObject = $('#trail');
    var separatorText = '&nbsp;&nbsp;&#8250;&#8250;&nbsp;&nbsp;';
    separatorText = $('<span/>').html(separatorText).text();
    // If additional trail items have been defined by calling setPageTrail(), add items to trail
    if (trailArray.length > 0) {
        $(trailArray).each(function(i){
            var newTrailText = $('#trail').children().length > 0 ? separatorText + trailArray[i] : trailArray[i];
            $('<span/>').text(newTrailText).appendTo(trailObject);
        });
    }
    // If the no main menu items are marked as current and no additional trail items have been specified,
    // show the src of the content frame as the trail.  This is unlikely to happen, but this check
    // prevents the layout looking strange when teh trail section contains no text.
    if (trailObject.children().length == 0) {
        $('<span>' + checkContentPath($('#contentframe').attr('src')) + '</span>').appendTo(trailObject);
    }
    $('#trail .current').removeClass('current');
    $('#trail :last').addClass('current');
    trailArray = new Array();

}


// -----------------------------------------------------------------------------
// Alerts and Messages
// -----------------------------------------------------------------------------

function showAlert(alertText,alertID,alertPath,alertClass,alertDetails,dismissTrueFalse) {
	jQuery(function() {
		var alertObj = $('#alert');
		var alertListObj = $('#alert-list').length == 0 ? $('<ul id="alert-list"></ul>').appendTo($('#alert')) : $('#alert-list');
		// Replace / Create new alert object
		if (alertID && $('#alert-' + alertID).length > 0) {
			var newAlertObj = $('#alert-' + alertID).empty();
		}
		else if ($('#alert-list li:contains(' + alertText + ')').length > 0) {
			var newAlertObj = $('#alert-list li:contains(' + alertText + '):first').empty();
		}
		else {
			var newAlertObj = $('<li></li>').appendTo(alertListObj);
		}
		newAlertObj.attr({
			id: alertID ? 'alert-' + alertID : '',
			className: alertClass ? alertClass : ''
		});
		// If a path has been specificed, wrap the text in an <a> tag
		if (alertPath) {
			$('<a href="' + alertPath +'" class="' + alertClass + '" title="' + alertDetails + '">' + alertText + '</a>').click(function(){
				if (alertClass == 'modal') {
					loadModal(alertPath);
					return false;
				}
				else if ($(this).attr('href') != '#') {
					loadContent($(this).attr('href'));
					return false;
				}
			}).appendTo(newAlertObj);
		}
		else {
			newAlertObj.html('<div title="' + alertDetails + '">' + alertText + '</div>');
		}
		// Render dismiss button if allowed
		if (dismissTrueFalse) {
			$('<a href="#" class="dismiss"><img src="' + path_imageDirectory + 'icon_close.png" class="png" /></a>').click(function(){
				$(this).parent().remove();
				return false;
			}).prependTo(newAlertObj);
		}
		// Show the alert. The alert will change the available content window
		// height so trigger the window resize after the alert is displayed
		alertObj.slideDown(400, function(){ $(window).trigger('resize'); } );
	});
	return false;
}

function hideAlert(alertID) {
	jQuery(function() {
		var alertObj = $('#alert');
		if (alertID) {
			$('#alert-' + alertID).remove();
		}
		else {
			alertObj.slideUp('',function(){
				alertObj.empty();
				$(window).trigger('resize');
			});
		}
	});
	return false;
}

function showMessage(type,title,text) {
	jQuery(function() {
		if (title == undefined) {
			if (type == 'loading') {
				title = string_loadingTitle;
				text = string_loadingText;
			}
			if (type == 'saving') {
				title = string_savingTitle;
				text = string_savingText;
			}
		}
		var messageObject = $('#message').empty();
		var typeObject = $('<div id="messagetype" class="type ' + type + '"><div class="indicator"></div></div>').appendTo(messageObject);
		var titleObject = $('<div id="messagetitle" class="title">' + title + '</div>').appendTo(typeObject);
		var textObject = $('<div id="messagetext" class="text">' + text + '</div>').appendTo(typeObject);
		if ($.browser.msie) {
			messageObject.show();
			//Adding or removing messages may change the content area size
			$(window).trigger('resize');
		}
		else {
			messageObject.fadeIn('fast',function(){ $(window).trigger('resize');});
		}

	});
	return false;
}

function hideMessage() {
	jQuery(function() {
		if ($.browser.msie) {
			$('#message').hide();
			//Adding or removing messages may change the content area size
			$(window).trigger('resize');
		}
		else {
			$('#message').fadeOut('fast',function(){$(window).trigger('resize');});
		}
	});
	return false;
}


// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------

function loadModal(modalContentPath,allowDismissTrueFalse) {
	jQuery(function() {
		if ($('#modal').css('display') == 'none') {
			ie6ModalFixToggle();
			$('#modal').show();
		}
		var modalFrame = frames['modalframe'].location.replace(checkContentPath(modalContentPath));
		$('#errorframe, #modalcontent').hide();
		$('#modalframe').show();
		dismissModal(allowDismissTrueFalse);
	});
	return false;
}

function showModal(modalContent,allowDismissTrueFalse) {
	jQuery(function() {
		if ($('#modal').css('display') == 'none') {
			ie6ModalFixToggle();
			$('#modal').show();
		}
		var modalContentContainer = $('#modalcontent');
		if (typeof(modalContent) == 'object') {
			modalContent = $(modalContent).html();
		}
		modalContentContainer.html('<div class="padding">' + modalContent + '</div>');
		$('#errorframe, #modalframe').hide();
		$('#modalcontent').show();
		dismissModal(allowDismissTrueFalse);
	});
	return false;
}

function hideModal() {
	jQuery(function() {
		$('#modal, #modalcontent, #modalframe, #errorframe').fadeOut();
		var modalFrame = frames['modalframe'];
		try {
			if (modalFrame.location.href.indexOf(path_blankPage) == -1) {
				modalFrame.location.replace(path_blankPage);
			}
		}
		catch(e) {
			modalFrame.location.replace(path_blankPage);
		}
		dismissModal(false);
		ie6ModalFixToggle();
	});
	return false;
}

function dismissModal(allow) {
	jQuery(function() {
		if (allow == false) {
			$('#modal .closebutton').hide();
			$('#modal .overlay').unbind();
		}
		else {
			$('#modal .closebutton').show();
			$('#modal .overlay').unbind().click(function(){
				hideModal();
			});
		}
	});
}

function ie6ModalFixToggle() {
	jQuery(function() {
		if ($.browser.msie && $.browser.version == '6.0') {
			if ($('html').css('overflow') != 'hidden') {
				scrollTo(0,0);
				$('body','html').css({height: '100%', width: '100%'});
				$('html').css('overflow','hidden');
				$('select').hide();
			}
			else {
				$('body','html').css({height: 'auto', width: 'auto'});
				$('html').css('overflow','');
				$('select').show();
			}
		}
	});
}

// Function that is called when the content of a modal has been loaded.
function initModalContent() {
	// If the user hits the tab key and there is at least one visible element to take the focus,
	// let the focus be handled normally.  Otherwise, kill the event so that the focus doesn't
	// leave the modal window.
	$(document.getElementById('modalframe').contentWindow.document).keydown(function(e) {
		if (e.keyCode == 9) {
			var ctrls = $(this).contents().find('button,input,a').filter(':visible');
			if (0 == ctrls.length) {
				e.preventDefault();
				e.stopPropagation();
			}
		}
	});

   // Delegate to the registered handler.  This is a one-shot.
   if (null != modalLoadedFunction) {
      try {
         modalLoadedFunction();
      } catch (err) {
         // Just trap the error.
      }
      modalLoadedFunction = null;
   }
}

// ----------------------------------------------------------------------------
// Client iframe modal behavior toggles
// Allow the content iframe to request modal behavior
// ----------------------------------------------------------------------------
function setContentModal(){
        //For IE8 compat mode, set modal as IE8:
        var isIE8CompatMode = $.browser.msie && $.browser.version == '7.0' && document.documentMode && document.documentMode == '8';
	if (!isIE8CompatMode && $.browser.msie && ($.browser.version == '6.0' || $.browser.version == '7.0')){
		// IE <= 7 is fundamentally broken in how it handles z-ordering
		// special case those browsers
		// TODO: delete this when IE7 support goes away
		var resizer = function(){
			// Set the height of the body overlay to be that of the html element's inner height
			// body doesn't include the height of out-of-flow elements where html does
			var h = getRealDocumentHeight(document);
			jQuery('#body-contentmodal:visible').css('height',h);
		}
		var panels = jQuery('#panels-contentmodal');
		if (panels.length <=0){
			jQuery('#panels').append('<div id="panels-contentmodal" style="display:none;" class="contentmodal"></div>');
		}
		var header = jQuery('#header-contentmodal');
		if (header.length <=0){
			jQuery('#header').append('<div id="header-contentmodal" style="display:none;" class="contentmodal"></div>');
		jQuery('#header-contentmodal').css('height',jQuery('#header').outerHeight());
		}
		var a = jQuery('#alert-contentmodal');
		if (a.length <=0){
			jQuery('#alert').append('<div id="alert-contentmodal" style="display:none;" class="contentmodal"></div>');
			jQuery('#alert-contentmodal').css('height',jQuery('#alert').outerHeight());
		jQuery('#alert-contentmodal').css('top',jQuery('#header-contentmodal').outerHeight());
		}
		var banner = jQuery('#banner-contentmodal');
		if (banner.length <=0){
			jQuery('#banner').append('<div id="banner-contentmodal" style="display:none;" class="contentmodal"></div>');
		}
		var pagemenu = jQuery('#pagemenu-contentmodal');
		if (pagemenu.length <=0){
			jQuery('#pagemenu').append('<div id="pagemenu-contentmodal" style="display:none;left:-1px;" class="contentmodal"></div>');
		}
		var b = jQuery('#body-contentmodal');
		if (b.length <=0){
			jQuery('body').append('<div id="body-contentmodal" style="display:none;z-index:-5000;" class="contentmodal"></div>');
			jQuery(window).bind('resize',resizer);
		}

		jQuery('.contentmodal').show();
		resizer();
	} else {
		releaseContentModal();
		$(document.body).append("<div id='body-contentmodal' class='contentmodal'></div>")
		$('#contentframe').css('z-index','199');
	}

}

function releaseContentModal(){
	jQuery('.contentmodal').hide().remove();
	$('#contentframe').css('z-index','');
}

// -----------------------------------------------------------------------------
// Content Functions
// -----------------------------------------------------------------------------

function renderContent() {
	jQuery(function() {
		// Render content frame
		var refreshPage = getCookie('f5_refreshpage');
		// Special handling just in case we somehow get the login page URL in the f5_refreshpage cookie (infinite loop)
		if (!isUrlToRememberForRefresh(refreshPage)) {
			refreshPage = '';
		}
		var contentSource = refreshPage ? unescape(refreshPage) : path_startPage ? path_startPage : $('#mainpanel div.module ul a:first').attr('href');
		$('#content').append('<div style="font-size: 0; line-height: 0; position: relative;"><iframe src="' + Escape.toXmlAttribute(contentSource) + '" id="contentframe" name="contentframe" allowtransparency="true" frameborder="no" scrolling="auto" onload="initContent();"></iframe></div>');
		// Begin auto-resize
		xuiResizeTimer = setInterval(resizeContent,100);
	});
}

function getRealDocumentHeight(docElement){
	var d = docElement;
	return Math.max(
		d.body.scrollHeight,
		d.body.offsetHeight,
		d.body.clientHeight);
}

function resizeContent() {
	var contentObj = $('#contentframe');
	var offset = contentObj.offset();
	var footerOffset = $('#advisoryfoot').height();
	if (!footerOffset) { footerOffset = 0; }
	var availHeight = $(window).height() - offset.top - footerOffset;

	// IE7 sometimes returns bogus negative offsets.  Skip this iteration if it happens
        if (offset.top < 0 ){ return;}
	try {
		var contentHeight = getRealDocumentHeight(frames['contentframe'].document);
		var newHeight = Math.floor(contentHeight > availHeight ? contentHeight : availHeight);
		// Some browsers (ahem, IE) can be off by as much as a pixel when reading and setting the
		// iframe height.  This is intermittent behavior and will cause the XUI resizer to go into
		// a loop that will lead to a crash on content pages that do complex resize handling.
		// To work around this, only resize if the difference in height is greater than one pixel.
		if (Math.abs(Math.floor(contentObj.height())-newHeight)>1) {
			contentObj.css('height',newHeight + 'px');
		}
	}
	catch(e) {
		if (Math.floor(contentObj.height()) != Math.floor(availHeight)) {
			contentObj.css('height',Math.floor(availHeight) + 'px');
		}
	}
}

function forceResizeContentToAvailableArea() {
	/* This function is only called if a window resize event is triggered
	   on the top frame *and* if the page in the content iframe has requested
	   constrained page resize handling by calling Xui.requestAvailableContentArea(true)
	   (defined in api.js) from within the content page.  This function will force
	   the content iframe to resize to the available content area in the browser (minux 2px
	   on each axis to catch a corner case where the browser adds unwanted scrollbars to the
	   iframe.) */
	try{
		var contentObj = $('#contentframe');
                var offset = contentObj.offset();
		var availHeight = $(window).height() - offset.top;
		var availWidth = $(window).width() - offset.left;
		// Some browsers (IE) will return bogus values if the offset is calculated
		// while the screen is still being resized.  Bail if the offset looks fishy
		if(offset.top < 0 ){return;}
		contentObj.css('height',Math.floor(availHeight-2) + 'px');
		contentObj.css('width',Math.floor(availWidth-2) + 'px');

	} catch(e){ console.log("error");}
}

function loadContent(href) {
	jQuery(function() {
		//attach date param to rest urls
		if (href.indexOf('/restui') === 0) {
			href = href + '?date=' + Date.now();
		}

		// Load content
		$('#contentframe').attr('src',href);
	});
	return false;
}

function initContent() {
	jQuery(function() {
		// Reset the XUI contentmodal state unless the content has requested otherwise
		if (frames['contentframe'].Xui && frames['contentframe'].Xui.retainContentModal === true){
			// keep the contentmodal state of this content
		} else {
			releaseContentModal();
		}

		// Attach Events
		try {
			var contentFrame = frames['contentframe'];
			$('#contentframe').css('overflow-y','hidden');
			// W3C (Standards)
			try {
				frames['contentframe'].addEventListener('beforeunload',initContentBeforeUnLoad,false);
				frames['contentframe'].addEventListener('unload',initContentUnLoad,false);
			}
			// Internet Explorer
			catch(e) {
				frames['contentframe'].attachEvent('onbeforeunload',initContentBeforeUnLoad);
				frames['contentframe'].attachEvent('onunload',initContentUnLoad);
			}
		}
		catch(e) {
			// External Source
			$('#contentframe').css('overflow-y','auto');
		}
		// Show content
		$('#contentframe').css('visibility','visible');
		// If no page menu has been defined, remove the old page menu and render the trail
		if (setpagemenu == false) {
			$('#pagemenu').remove();
		}
		// Render Page Trail
		renderPageTrail();

                prevTrailArray = trailArray;

		// Hide the page panel if the new page did not set one
		if (setpagepanel == false && !pagepanelispersistent) {
			hidePanel();
		}
		// Load help page
		if ($('#helppanel').hasClass('current') || xuiHelpWindow != null) {
			loadHelp();
		}
		// Hide transient loading message
		if ($('#messagetype').hasClass('loading')) {
			hideMessage();
		}
		if (xuiUpdateTimer == null || xuiUpdateTimer == -1) {
	        startUpdates();
		}
		contentLoaded = true;
    });
}

function initContentBeforeUnLoad() {
	// Note: Wekbit browsers do not allow onbeforeunload to fire for iframe content.
	jQuery(function() {
		// Show loading message
		showMessage('loading');
		// Special handling for EM's unit test framework
		window.contentLoaded = false;
	});
}

function initContentUnLoad() {
	jQuery(function() {
		// Show loading message (check to prevent double-rendering)
		// $.browser.safari = check for webkit (see Bug 350410)  Can be removed when Webkit onbeforeunload bug is fixed.
		if (($('#message').css('display') == 'none') || $.browser.safari) {
			showMessage('loading');
		}
		// Reset variables
		contentLoaded = false;
		setmainmenu = false;
		setpagemenu = false;
		setpagehelp = false;
		setpagepanel = false;
        bs3Page = null;

		// Hide content (prevents white flashes in Webkit)
                $('#contentframe').css('height','0px');

        // Remove window event handlers
        $(window).unbind(windowEventsNamespace);
	});
}


function getContentUrl() {
    try {
		var contentFrame = frames['contentframe'];
		if (contentFrame && contentFrame.location.href != 'about:blank') {
            if (null != bs3Page) {
                return bs3Page;
            } else {
	            return contentFrame.location.href;
            }
		}
    }
    catch(e) {
		var contentFrame = $('#contentframe');
		if (contentFrame && contentFrame.attr('src') != 'about:blank') {
            if (null != bs3Page) {
                return bs3Page;
            } else {
                return contentFrame.attr('src');
            }
		}
		else {
			return false;
		}
    }
}

function checkContentPath(path) {
	// This function takes paths relative to the content frame and converts them
	// to absolute paths from the XUI location.  This conversion is necessary for
	// content that will be loaded by clicking a link located in the XUI parent window.
	// For example, a link with a relative path defined in the content frame of
	// "stuff/page.html" needs to have the path converted to
	// "/path/to/xui/module/directory/stuff/page.html" to properly link from the XUI.
	if (path.indexOf('://') == -1 && path.substring(0,1) != '/' && path.toLowerCase().indexOf('javascript:') != 0) {
		try {
			var contenthref = frames['contentframe'].location.href;
			path = contenthref.substring(frames['contentframe'].location.hostname,contenthref.lastIndexOf('/') + 1) + path;
		}
		catch(e) {}
	}
	return path;
}

function isUrlToRememberForRefresh(url) {
	// We want to keep certain URLs from being "remembered" in the f5_refreshpage cookie.
	// examples: null/blank values, login page URL, redirect page URL, etc.
	if (url == null || url == '') {
		return false;
	}
	if (url == path_startPage) {
		return false;
	}
	else if (url.indexOf(path_loginPage) > -1) {
		return false;
	}
	else if (url.indexOf(path_rebootPage) > -1) {
		return false;
	}
    else if( url.match(path_waui_re) ){
//        var url1 = url.match(path_waui_re);
//        alert(" URL NOT TO REMEMBER: " + url1[1] )
        return false;
    }
	else {
		return true;
	}
}

function exit(url) {
	stopUpdates();
	window.top.location.href = url;
}


// ------------------------------------------------------------------------------
// Panel Functions
// ------------------------------------------------------------------------------

function showPanel(panelID) {
	jQuery(function(){
		$('#tabs li.current, #panels > div.current').removeClass('current');
		$('#' + panelID + 'tab').addClass('current');
		if (panelID == 'main' && setpagepanel) {
			$('#wizardpanel').addClass('current');
			resizeFrameHeight('wizardframe');
		}
		else {
			$('#' + panelID + 'panel').addClass('current');
		}
	});
	return false;
}

function loadPanel(panelContentUrl,forceRefreshTrueFalse,exitButtonText, exitLink) {
	jQuery(function(){
		var isSamePanelContent;
		try {
		// Check to see if new content URL is the same as the existing URL
		var panelFrameUrl = frames['wizardframe'].location.href;
		panelFrameUrl = panelFrameUrl.substring(panelFrameUrl.lastIndexOf(frames['wizardframe'].location.pathname),panelFrameUrl.length);
			isSamePanelContent = new RegExp(escape(panelContentUrl) + '$').test(escape(panelFrameUrl));
		}
		catch(e) {
			isSamePanelContent = false;
		}
		// Load the new content
		if (!isSamePanelContent || forceRefreshTrueFalse) {
		frames['wizardframe'].location.replace(checkContentPath(panelContentUrl));
			if (exitButtonText) {
				var optionsObj = $('#wizardpanel div.options').empty().show();
                                // This controls where the browser will end up when they exit the panel.
                                // Set up a link to where they were when they entered.
                                if(typeof exitLink == 'undefined'){
				    exitLink = $('#mainmenu-' + currentMainMenuID + '-' + currentMainLinkID + ' a:first').attr('href');
				}
				$('<a href="' + exitLink + '" class="exit" target="contentframe" onClick="pagepanelispersistent=false;hidePanel();"><span>' + exitButtonText + '</span></a>').appendTo(optionsObj);
			}
			else {
				var optionsObj = $('#wizardpanel div.options').empty().hide();
			}
		}
		// Show / Hide main menus and panels
		if ($('#mainpanel').hasClass('current')) {
			$('#mainpanel').removeClass('current');
			$('#wizardpanel').addClass('current');
		}
	});
	return false;
}

function hidePanel() {
	jQuery(function(){
                pagepanelispersistent = false;
		var panelID = $('#tabs li.current:first').attr('id').replace('tab','');
		$('#panels > div.current').removeClass('current');
		$('#' + panelID + 'panel').addClass('current');
		frames['wizardframe'].location.replace(path_blankPage);
	});
}

function initPanelLoad() {
	jQuery(function() {
		try {
		var windowFrame = frames['wizardframe'];
		var windowDocument = $(windowFrame.document.documentElement);
		// Check URL Values
		var windowUrl = windowFrame.document.URL;
		if (windowUrl.indexOf('?') != -1) {
			var urlValuePairList = windowUrl.split('?')[1].split('&');
			$(urlValuePairList).each(function(i) {
				var urlValuePair = this.split('=');
				var pairName = urlValuePair[0];
				var pairValue = urlValuePair[1];
				if (pairName == 'current') {
					Xui.showStep(pairValue);
				}
				else if (pairName == 'error') {
					$(pairValue.split(',')).each(function() {
						windowDocument.find('#' + this).addClass('error').find('.steplabel:first').addClass('error');
					});
				}
				else if (pairName == 'hide') {
					$(pairValue.split(',')).each(function() {
						windowDocument.find('#' + this).hide();
					});
				}
				else if (pairName == 'show') {
					$(pairValue.split(',')).each(function() {
						windowDocument.find('#' + this).show();
					});
				}
			});
			resizeFrameHeight('wizardframe');
		}
		// Check for panel steps
		if (windowDocument.find('ol.steplist').length != 0) {
			// Attach step link events
			windowDocument.find('.steplabel a').click(function(){
				if ($(this).parent().hasClass('incomplete')) {
					return false;
				}
				else if ($(this).attr('href') != '#') {
					loadContent(checkContentPath($(this).attr('href')));
					return false;
				}
				else {
					Xui.showStep($(this).parents('li:first').attr('id'));
					return false;
				}
			});
			// If current step is not marked, mark mark the first visible step
			var currentStepObj = windowDocument.find('li.step.current');
			if (currentStepObj.length == 0) {
				Xui.showStep(windowDocument.find('li.step:visible:first').attr('id'));
			}
		}
		else {
			// Show all buttons
			try {
				var contentDocument = $(frames['contentframe'].document.documentElement);
				contentDocument.find('div.buttons a').css('display','block');
			}
			catch(e) {}
		}
		// Attach panel resize event
		$(windowDocument).find('body').click(function() {
			resizeFrameHeight('wizardframe');
		});
		// Attach toggle events
		$(windowDocument).find('dl.toggle dd').hide();
		$(windowDocument).find('dl.toggle dt a').click(function() {
			$(this).parent().toggleClass('expand').next('dd').toggle();
			// return false;
		});
		}
		catch(e) {}
	});
}

// ------------------------------------------------------------------------------
// Help Functions
// ------------------------------------------------------------------------------

function loadHelp() {
	jQuery(function(){
		// If no help page has been defined, show the "No help page available" page
		var path = setpagehelp == false ? path_noHelpPage : setpagehelp;
		// Load help page in panel if "Help" is the current tab
		var helpFrameObject = frames['helpframe'];
		var isCurrentTab = $('#helptab').hasClass('current');
		try {
			var isNewPage = helpFrameObject.location.href.indexOf(path) == -1 ? true : false;
		}
		catch(e) {
			var isNewPage = true;
		}
		if (isCurrentTab && isNewPage) {
			helpFrameObject.location.replace(checkContentPath(path));
			$('#helppanel-collapse').hide();
			$('#helppanel-expand').show();
		}
		// Load help page in external window if open
		if (xuiHelpWindow && !xuiHelpWindow.closed && xuiHelpWindow.location) {
			var isWindowOpen = xuiHelpWindow ? true : false;
			var isNewPage = xuiHelpWindow.location.href.indexOf(path)  == -1 ? true : false;
			if (isWindowOpen && isNewPage) {
				xuiHelpWindow.location.href = checkContentPath(path);
			}
		}
		return false;
	});
}

// -----------------------------------------------------------------------------
// API - Helper Functions
// -----------------------------------------------------------------------------

function Map() {
	this.keys = new Array();
	this.map = new Object();
	this.get = function(key) {
		return this.map[key];
	};
	this.containsKey = function(key) {
		return !(this.get(key) == undefined);
	};
	this.containsValue = function(value) {
		for (var i=0; i < this.keys.length; i++) {
			if (this.map[this.keys[i]] == value) {
				return true;
			}
		}
		return false;
	};
	this.put = function(key, value) {
		if (!this.containsKey(key)) {
			this.keys.push(key);
		}
		this.map[key] = value;
	};
	this.remove = function(key) {
		if (this.containsKey(key)) {
			for (var i=0; i < this.keys.length; i++) {
				if (this.keys[i] == key) {
					this.keys.splice(i, 1);
					break;
				}
			}
			this.map[key] = undefined;
		}
	};
	this.size = function() {
		return this.keys.length;
	};
}

function Stack() {
	this.stack = new Array();
	this.size = 0;
	this.push = function(object) {
		this.stack.push(object);
		this.size = this.stack.length;
	};
	this.pop = function() {
		var top = this.top();
		this.stack.pop();
		this.size = this.stack.length;
		return top;
	};
	this.top = function() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1];
		}
		else {
			return null;
		}
	};
	this.clear = function() {
		this.stack = new Array();
		this.size = 0;
	};
}

var NODE_ELEMENT = 1;
var NODE_ATTRIBUTE = 2;
var NODE_TEXT = 3;
var NODE_CDATA_SECTION = 4;
var NODE_ENTITY_REFERENCE = 5;
var NODE_ENTITY = 6;
var NODE_PROCESSING_INSTRUCTION = 7;
var NODE_COMMENT = 8;
var NODE_DOCUMENT = 9;
var NODE_DOCUMENT_TYPE = 10;
var NODE_DOCUMENT_FRAGMENT = 11;
var NODE_NOTATION = 12;

function createNode(tagName, attributes, documentNode) {
	var node;
	var keys = attributes.keys;
	if (documentNode) {
		try {       // Internet Explorer
			node = documentNode.createNode(NODE_ELEMENT, tagName, "");
		}
		catch (e) { // Mozilla
			node = documentNode.createElement(tagName);
		}
		for (var i=0; i < keys.length; i++) {
			node.setAttribute(keys[i], attributes.get(keys[i]));
		}
	}
	else {
		var tagSource = "<" + tagName;

		for (var i=0; i < keys.length; i++) {
			tagSource += " " + keys[i] + "='" + attributes.get(keys[i]) + "'";
		}
		tagSource += "/>";
		try {       // Internet Explorer
			node = new ActiveXObject("Msxml2.DOMDocument.3.0");
			node.async = false;
			node.loadXML(tagSource);
			if (node.parseError.errorCode != 0) {
				alert("Deal request parse error: " + node.parseError.reason);
			}
		}
		catch (e) { // Mozilla
			node = new DOMParser().parseFromString(tagSource, "text/xml");
		}
	}
	return node;
}

function validateNode(nodeObject) {
	var err = nodeObject.validate();
	if (err.errorCode == 0) {
		return true;
	}
	else {
		alert("Validation error:" + err.reason);
		return false;
	}
}

AMPERSAND = "&";

function trim(string) {
	return string.replace(/^\s+/, '').replace(/\s+$/, '');
}

function setCursor(cursor) {
	try {
		document.body.style.cursor = cursor;
	}
	catch (e) {}
}

function Escape() {
	this.toXmlAttribute = function(value) {
		if (!value) {
			return null;
		}
		var output = value;
		output = output.replace(/</g, "&#60;");
		output = output.replace(/\"/g, "&#34;");
		output = output.replace(/'/g, "&#39;");
		output = output.replace(/\r\n/g, "&#10;");
		output = output.replace(/\n/g, "&#10;");
		output = output.replace(/&/g, "&#38;");
		return output;
	};
	this.fromXmlAttribute = function(value) {
		if (!value) {
			return null;
		}
        	var output = value;
        	output = output.replace(/&#38;/g, "&");
        	output = output.replace(/&amp;/g, "&");
        	output = output.replace(/&#10;/g, "\n");
        	output = output.replace(/&#39;/g, "'");
        	output = output.replace(/&#34;/g, "\"");
        	output = output.replace(/&#60;/g, "<");
        	output = output.replace(/&lt;/g, "<");
        	output = output.replace(/&gt;/g, ">");
		return output;
	};
    this.toXmlText = function(value) {
        if (!value) {
            return null;
        }
        var output = value;
        output = output.replace(/&/g, "&amp;");
        output = output.replace(/</g, "&lt;");
        output = output.replace(/>/g, "&gt;");
        return output;
    };
}

Escape = new Escape();

function URL(url) {
	this.url = url;
	this.getPath = function() {
		var path = this.url;
		var index;
		if (index = path.indexOf("://")) {
			path = path.substring(index + 3);
		}
		return path;
	};
}


// -----------------------------------------------------------------------------
// API - Content Functions
// -----------------------------------------------------------------------------
Xui.addCollapsibleMainMenu = function() {
	if ( $("#content").length !== 0 && ($("#content > span.expand-main-menu").length === 0 && $('#content > span.collapse-main-menu').length === 0)) {
		$("#content").prepend("<span class='expand-main-menu'></span> <span class='collapse-main-menu'>  </span>");
		$("#content > span.collapse-main-menu").click(function () {
			$("#content > span.collapse-main-menu").hide();
			$("#content > span.expand-main-menu").show();
			$("#tabs").hide();
			$("#panels").hide(450);

			$("#trail").animate({'margin-left': '2em'}, {duration: 450});
			$(document.body).animate({'background-position-x': 0}, { duration: 450});
			$("#content").animate({'margin-left': '2em'}, {duration:450});
		});

		$("#content > span.expand-main-menu").click(function () {
		$("#content > span.collapse-main-menu").show();
			$("#content > span.expand-main-menu").hide();
			$("#tabs").show(450);
			$("#panels").show(450);
			$("#trail").animate({'margin-left': '21.5em'}, {queue: false});
			$(document.body).animate({'background-position-x': '20em'}, {queue: false});
			$("#content").animate({'margin-left': '21.5em'}, {queue: false});
		});

	}
}

Xui.removeCollapsibleMainMenu = function() {
	 //remove collapse
	if ($("#content > span.collapse-main-menu").length !== 0) {
		$("#content > span.collapse-main-menu").remove();
	}
	//remove expand
	if ($("#content > span.expand-main-menu").length !== 0) {
		$("#content > span.expand-main-menu").remove();
	}
}

// See Bug 222811
Xui.setBS3Page = function(path) {
    bs3Page = path.replace(/&amp;/g, "&");
    return false;
}

// Updates
Xui.update = function() {
	stopUpdates();
	startUpdates();
	return false;
};

// Partitions
Xui.enablePartitions = function() {
	var partitionSelectObj = $('#partition_control').attr('disabled', false);
	return false;
};

Xui.disablePartitions = function() {
	var partitionSelectObj = $('#partition_control').attr('disabled', true);
	return false;
};

Xui.isPartitionDisabled = function(){
	return $('#partition_control').attr('disabled');
}

// Panels
Xui.setPanel = function(path,forceRefreshTrueFalse,exitButtonText, isPersistent, exitLink) {
	setpagepanel = true;
    pagepanelispersistent = (null != isPersistent) ? isPersistent : false;
	loadPanel(path,forceRefreshTrueFalse,exitButtonText, exitLink);
	return false;
};

Xui.findPanelObj = function(cssSelector)  {
	var panelObj = $(window.parent.frames['wizardframe'].document.documentElement);
	return panelObj.find(cssSelector);
};

Xui.hidePanelObj = function(cssSelector)  {
	var obj = Xui.findPanelObj(cssSelector).css('display','none');
	resizeFrameHeight('wizardframe');
	return obj;
};

Xui.showPanelObj = function(cssSelector)  {
	var obj = Xui.findPanelObj(cssSelector).css('display','block');
	resizeFrameHeight('wizardframe');
	return obj;
};

Xui.togglePanelObj = function(cssSelector)  {
	var obj = Xui.findPanelObj(cssSelector).each(function(){
		if ($(this).parent().hasClass('toggle')) {
			$(this).toggleClass('expand');
		}
		else {
			$(this).toggle();
		}
	});
	resizeFrameHeight('wizardframe');
	return obj;
};

// Step Navigation
Xui.showStep = function(stepObjId) {
	jQuery(function() {
		var windowFrame = frames['wizardframe'];
		var windowDocument = $(windowFrame.document.documentElement);
		// Mark current step in panel
		var showObj = windowDocument.find('#' + stepObjId);
		windowDocument.find('.current').removeClass('current');
		showObj.show().parents('ol.steplist').show();
		showObj.removeClass('complete incomplete').addClass('current');
		showObj.find('.steplabel:first, div.steptext:first').removeClass('complete incomplete').addClass('current');
		// Mark other steps
		var stepArray = windowDocument.find('li.step');
		var currentIndex = jQuery.inArray(showObj[0], stepArray);
		stepArray.each(function(i){
			// Steps before current
			if (i < currentIndex) {
				$(this).removeClass('incomplete').addClass('complete');
				$(this).find('.steplabel:first').removeClass('incomplete').addClass('complete');
			}
			// Steps after current
			else if (i > currentIndex) {
				$(this).removeClass('complete error').addClass('incomplete');
				$(this).find('.steplabel:first').removeClass('complete error').addClass('incomplete');
			}
		});
		resizeFrameHeight('wizardframe');
		try {
			// Show appropriate step in content area
			var contentFrame = frames['contentframe'];
			var contentDocument = $(contentFrame.document.documentElement);
			contentDocument.find('.step').hide();
			contentDocument.find('#' + showObj.attr('id')).css('display','block');
			// Show appropriate buttons
			var isFirstStep = showObj[0] == Xui.findPanelObj('li.step:first')[0];
			var isLastStep = showObj[0] == Xui.findPanelObj('li.step:last')[0];
			var buttonContainer = contentDocument.find('div.buttons');
			buttonContainer.find('a.cancel').css('display','block');
			if (isFirstStep) {
				buttonContainer.find('a.previous, a.finish').hide();
				buttonContainer.find('a.continue').css('display','block');
			}
			else if (isLastStep) {
				buttonContainer.find('a.continue').hide();
				buttonContainer.find('a.previous, a.finish').css('display','block');
			}
			else {
				buttonContainer.find('a.finish').hide();
				buttonContainer.find('a.continue, a.previous').css('display','block');
			}
		}
		catch(e) {}
	});
};

Xui.nextStep = function() {
	jQuery(function() {
		var currentObj = Xui.findPanelObj('li.current');
		// Nested?
		var nextObj = currentObj.find('ol.steplist:visible li.step:visible:first');
		if (nextObj.length == 0) {
			// Sibling?
			nextObj = currentObj.nextAll('li.step:visible:first');
			if (nextObj.length == 0) {
				// Parent sibling
				nextObj = currentObj.parent().parent().nextAll('li.step:visible:first');
			}
		}
		if (nextObj.length != 0) {
			Xui.showStep(nextObj.attr('id'));
		}
	});
};

Xui.previousStep = function() {
	jQuery(function() {
		var currentObj = Xui.findPanelObj('li.current');
		// Nested?
		var prevObj = currentObj.prevAll('li.step:visible:first').find('ol.steplist:visible li.step:visible:last');
		if (prevObj.length == 0) {
			// Sibling?Event
			prevObj = currentObj.prevAll('li.step:visible:first');
			if (prevObj.length == 0) {
				// Parent sibling
				prevObj = currentObj.parents('li.step:first');
			}
		}
		if (prevObj.length != 0) {
			Xui.showStep(prevObj.attr('id'));
		}
	});
};

Xui.nextStepUrl = function(url) {
	try {
		var contentFrame = frames['contentframe'];
		var currentPath = contentFrame.window.location.pathname;
		if (!url) {
			var currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1,currentPath.length);
			var currentName = currentFile.split('.')[0];
			var nextStep = parseInt(currentName.match(/(\d+)$/g),10) + 1;
			var nextName = currentName.replace(/(\d+)$/g,nextStep);
			contentFrame.window.location.href = contentFrame.window.location.href.replace(currentName,nextName);
		}
		else {
			contentFrame.window.location.href = url;
		}
	}
	catch(e) {}
	return false;
};

Xui.previousStepUrl = function(url) {
	try {
		var contentFrame = frames['contentframe'];
		var currentPath = contentFrame.window.location.pathname;
		if (!url) {
			var currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1,currentPath.length);
			var currentName = currentFile.split('.')[0];
			var nextStep = parseInt(currentName.match(/(\d+)$/g),10) - 1;
			var nextName = currentName.replace(/(\d+)$/g,nextStep);
			contentFrame.window.location.href = contentFrame.window.location.href.replace(currentName,nextName);
		}
		else {
			contentFrame.window.location.href = url;
		}
	}
	catch(e) {}
	return false;
};

// Main Menu
Xui.setMainMenu = function(mainMenuID,mainLinkID, contextName, contextParams) {
	setmainmenu = true;
	markMainMenu(mainMenuID,mainLinkID, true, contextName, contextParams);
};

Xui.setPageMenu = function(pageMenu, optionalLinkId) {
	if (pageMenu) {
        setpagemenu = true;

		// If an object is being passed, generate a DOM object and render the page menu
		if (typeof(pageMenu) == 'object') {
			var attributes = new Map();
			var menu = createNode("pagemenu", attributes);
			for (var i=0; i<pageMenu.items.length; i++) {
				if (pageMenu.items[i] instanceof Xui.PageMenu.Link) {
					attributes = new Map();
					attributes.put("label", pageMenu.items[i].label);
					attributes.put("path", pageMenu.items[i].path);
					attributes.put("class", pageMenu.items[i].type);
					menu.lastChild.appendChild(createNode("link", attributes, menu));
				}
				else if (pageMenu.items[i] instanceof Xui.PageMenu.DropMenu) {
					attributes = new Map();
					attributes.put("label", pageMenu.items[i].label);
					var submenu = createNode("submenu", attributes, menu);
					menu.lastChild.appendChild(submenu);
					var sm = pageMenu.items[i].items;
					for (var j=0; j<sm.length; j++) {
						attributes = new Map();
						attributes.put("label", sm[j].label);
						attributes.put("path", sm[j].path);
						attributes.put("class", sm[j].type);
						submenu.appendChild(createNode("link", attributes, menu));
					}
				}
			}
			renderPageMenu(frames['contentframe'].location.href, menu, optionalLinkId);
		}
		// If a string is being passed, assume it is a path to a pagemenu XML
		else {
			setpagemenu = 'ajax';
			jQuery.ajax({
				url: checkContentPath(pageMenu),
				success: function(responseXML) {
					renderPageMenu(frames['contentframe'].location.href,responseXML,optionalLinkId);
					setpagemenu = true;
				},
				error: function() {
					$('#pagemenu li.root').remove();
				}
			});
		}
	}
	else {
        setpagemenu = false;
		$('#pagemenu li.root').remove();
	}
	return false;
};

Xui.updateMainMenu = function(mainMenuID, mainLinkID, callback) {
	if (mainMenuID && mainLinkID) {
    	renderMainMenu(mainMenuID, mainLinkID, undefined, callback);
	}
	else {
		renderMainMenu(undefined, undefined, undefined, callback);
	}
	return false;
};

// Page Menu
Xui.PageMenu = function(items) {
    this.items = (items) ? items : new Array();
};

Xui.PageMenu.Link = function(label, path, type) {
    this.label = label;
    this.path = path;
    this.type = type;
};

Xui.PageMenu.DropMenu = function(label, items) {
    this.label = label;
    this.items = (items) ? items : new Array();
};

// Help
Xui.setPageHelp = function(path) {
	setpagehelp = checkContentPath(path);
};

Xui.updateHelpPanel = function() {
	loadHelp();
};

// Trail
/* This function sets the Page Trail. It can also force render Page trail
 	by passing last argument true(boolean). Force render Page Trail functionality
 	is useful when current page is not suppose to be reloaded but only Page Trail
 	needs to be updated with new value. */
Xui.setPageTrail = function() {
	trailArray = arguments;
	if (arguments.length > 1 && (typeof arguments[arguments.length-1] === 'boolean')) {
		trailArray = Array.prototype.slice.call(arguments, 0, -1);
		if (arguments[arguments.length-1]) {
			renderPageTrail();
		}
	}
};

Xui.renderPageTrail = function() {
	renderPageTrail();
};

Xui.getVersion = function() {
	return xui_version;
};

Xui.setContentModal = function(){
	setContentModal();
};

Xui.releaseContentModal = function(){
	releaseContentModal();
};

Xui.setPartition = function(value){
	var oldVal = $('#partition_control').val();
	$('#partition_control').val(value);
	var newVal = $('#partition_control').val();
	if (newVal == value){
		if (oldVal != newVal){
			$('#partition_control').trigger('change');
		}
	} else {
		$('#partition_control').val(oldVal);
	}
}

Xui.getPartition = function() {
    var retval = getCookie('F5_CURRENT_PARTITION');
    if(!retval) {
        retval = 'Common';
    }
    return retval;
}

Xui.getDocument = function() {
    return document;
}

var proxyModeAnimationLock = 0;

Xui.remoteTo = function(addr, partition) {
	stopUpdates();

	Xui.setPageMenu();
	$("#trail").empty();

	proxyModeAnimationLock++;
	$("#panels").css("overflow", "hidden");
	$("#panels").css("position", "relative").animate({left: "-=" + $("#panels").width()}, function() {
		$("#panels").hide();
		proxyModeAnimationLock--;
	});

	proxyModeAnimationLock++;
	if ($("#header-bg").length == 0) {
		$("#header").wrap($("<div id='header-bg'/>").css({height: $("#header").outerHeight(), width: '100%', background: '#333'}));
	}
	$("#header").css("position", "relative").animate({top: "-=" + $("#header").outerHeight()}, function() {
		$("#header-bg").css("position", "relative");
		$("#header").hide();
		proxyModeAnimationLock--;
	});

	proxyModeAnimationLock++;
	$("#status").fadeOut(function() {
		proxyModeAnimationLock--;
	});

	document.cookie="proxied_device=" + addr + "; path=/; SECURE;"
	document.cookie="last_local_page=" + getContentUrl() + "; path=/; SECURE;"
	document.cookie="last_local_partition=" + getCookie("F5_CURRENT_PARTITION") + "; path/; SECURE;"
	if (partition != null && partition.length > 0) {
		setCookie("F5_CURRENT_PARTITION", partition);
	}
	lastProxiedDevice = addr;
	licenseResponse = null;

	proxyModeAnimationLock++;
	renderMainMenu(undefined, undefined, undefined, function() {
		proxyModeAnimationLock--;
	});

	startUpdates(function() {
		function callback() {
			if (proxyModeAnimationLock > 0) {
				setTimeout(callback, 200);
				return;
			}
			$("#panels").css("position", "static").css("left", "auto").fadeIn();
			$("#panels").css("overflow", "visible");
			$("#header").css("position", "static").css("top", 0).fadeIn();
			setTimeout(function() { $("#status").fadeIn(); }, 500);
		}
		setTimeout(callback, 1);
	});
};

Xui.local = function() {
	stopUpdates();

	Xui.setPageMenu();
	$("#trail").empty();

        if (currentMainMenuID != null) {
            $("#" + "mainmenu-" + currentMainMenuID + " > ul.root").hide();
        }

	proxyModeAnimationLock++;
	$("#panels").fadeOut(function() {
		$("#mainpanel").removeClass("remote").empty();
		proxyModeAnimationLock--;
	});

	proxyModeAnimationLock++;
	$("#header").fadeOut(function() {
		proxyModeAnimationLock--;
	});

	proxyModeAnimationLock++;
	$("#status").fadeOut(function() {
		proxyModeAnimationLock--;
	});

	// This was originally all one function but I had to bust it up like this because there
	// was some sort of timing error in IE8 where the left-hand menu would not reappear.
	// Separating the animation into 3 phases and waiting for the locks to clear seemed to
	// fix the problem in IE8.
	localPhaseTwo();
};

function localPhaseTwo() {
	if (proxyModeAnimationLock > 0) {
		setTimeout(localPhaseTwo, 200);
		return;
	}
	licenseResponse = null;
	lastProxiedDevice = null;
	delCookie("proxied_device");
	var lastLocalPage = getCookie("last_local_page");
	var lastLocalPartition = getCookie("last_local_partition");
	delCookie("last_local_page");
	delCookie("last_local_partition");
	if (lastLocalPartition.length > 0) {
		setCookie("F5_CURRENT_PARTITION", lastLocalPartition);
	} else {
		setCookie("F5_CURRENT_PARTITION", "Common");
	}
	if (lastLocalPage != null) {
		setCookie("f5_refreshpage", lastLocalPage);
		loadContent(lastLocalPage);
	} else {
		delCookie("f5_refreshpage");
		loadContent(path_startPage ? path_startPage : $('#mainpanel div.module ul a:first'));
	}

	proxyModeAnimationLock++;
	renderMainMenu(undefined, undefined, undefined, function() {
		proxyModeAnimationLock--;
	});

	localPhaseThree();
};

function localPhaseThree() {
	if (proxyModeAnimationLock > 0) {
		setTimeout(localPhaseThree, 200);
		return;
	}

        startUpdates();

	$("#panels").css("overflow", "hidden");
	$("#panels").css("position", "relative").css("left", "-" + $("#panels").width() + "px").show().animate({left: "+=" + $("#panels").width()}, function() {
		$("#panels").css("overflow", "visible");
	});
        $("#header").css("position", "relative").css("top", "-" + $("#header").outerHeight() + "px").show().animate({top: "+=" + $("#header").outerHeight()});
	$("#status").fadeIn();
};

// Event handling

Xui.addWindowEventHandler = function(event, handler) {

    // Bind event handler to window object using namespace for easy unbind when unloading
    $(window).bind(event + windowEventsNamespace, handler);
}

Xui.removeWindowEventHandler = function(event, handler) {

    // Bind event handler to window object using namespace for easy unbind when unloading
    $(window).unbind(event + windowEventsNamespace, handler);
}

Xui.getWindowHeight = function() {
    return $(window).height();
}

Xui.scrollToFramePosition = function(top) {
    var frameTop = $(window.document).find("#contentframe").offset().top;
    $(window).scrollTop(frameTop + top);
}

Xui.getScrollTop = function() {
    return $(window).scrollTop();
}

Xui.hideMessage = function() {
    hideMessage();
}

Xui.setPartitionUpdateHandler = function(handler) {
    partitionUpdateHandler = handler;
}
