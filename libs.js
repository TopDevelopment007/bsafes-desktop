
var server_addr = 'https://www.openbsafes.com'
var forge = require('node-forge');
var ejse = require ("electron").remote.require('ejs-electron');
var BSON = require('bson');
var remote = require ("electron").remote;
var moment = require('moment');

function makeCallNavigate(link)
{
	var href = "javascript:navigateView('" + link + "')";
	//console.log(href);
	return href;
}

function navigateView(view)
{

	const remote = require ("electron").remote;
	//const app = require('electron').remote.app
	const url = require('url');
	const path = require('path');
	//const ejse = require ("electron").remote.require('ejs-electron');

	if ( view.startsWith("/teams/") ) {
		view = 'teams.ejs'
	} else if ( view.startsWith("/team/") ) {
		teamId = view.replace("/team/", "")
		view = 'team.ejs'
	} else if ( view.startsWith("/page/") ) {
		itemId = view.replace("/page/", "")
		view = 'page.ejs'
	} else if ( view.startsWith("/box/") ) {
		itemId = view.replace("/box/", "")
		view = 'box.ejs'
	} else if ( view.startsWith("/notebook/p/") ) {
		itemId = view.replace("/notebook/p/", "")
		view = 'notebookPage.ejs'
	} else if ( view.startsWith("/notebook/") ) {
		itemId = view.replace("/notebook/", "")
		view = 'notebook.ejs'
	} else if ( view.startsWith("/folder/p/") ) {
		itemId = view.replace("/folder/p/", "")
		view = 'folderPage.ejs'
	} else if ( view.startsWith("/folder/") ) {
		itemId = view.replace("/folder/", "")
		view = 'folder.ejs'
	} else if ( view.startsWith("/diary/p/") ) {
		itemId = view.replace("/diary/p/", "")
		view = 'diaryPage.ejs'
	} else if ( view.startsWith("/diary/") ) {
		itemId = view.replace("/diary/", "")
		view = 'diary.ejs'
	} else if ( view.startsWith("/safe/") ) {
		view = 'safe.ejs'
	}

	switch (view) {
		case 'keyEnter.ejs' :
			ejse.data('redirectURL', 'teams.ejs')
			ejse.data('keyHint', 'keyHint')
			break;
		case 'team.ejs' :
			ejse.data('teamId', teamId)
			break;		
		case 'safe.ejs' :
			ejse.data('teamId', 'u:' + remote.getGlobal('loginUserId'))
			ejse.data('loginUserId', remote.getGlobal('loginUserId'))
			break;
		case 'folder.ejs' :
		case 'box.ejs' :
		case 'notebook.ejs' :
		case 'diary.ejs' :
			ejse.data('initialDisplay', 'contents')
		case 'page.ejs' :
		case 'notebookPage.ejs' :		
		case 'folderPage.ejs' :	
		case 'diaryPage.ejs' :	
			ejse.data('itemId', itemId)			
			break;
		default :
			console.log('edi_error1')
			console.log(view)
			break;
	}

	const remote_win = remote.getCurrentWindow ();

	remote_win.loadURL(url.format({
	    pathname: path.join(__dirname, view),
	    protocol: 'file:',
	    slashes: true
	  }));

}

function checkItemType(itemId)
{
  var itemType = itemId.split(':')[0];
  var retType = '';

  switch(itemType) {
  	case 'u': // personal       
      retType = 'personal';
      break;
    case 't1': // team       
      retType = 'team';
      break;
    case 'p':
      retType = 'page';
      break;
    case 'f': // folder
      retType = 'container';
      break;
    case 'b': // box
      retType = 'container';
      break;
    case 'n': // notebook
      retType = 'container';
      break;
    case 'np': // notebook/p/
      retType = 'page';
      break;
    case 'd': // diary
      retType = 'container';
      break;
    case 'dp': // diary/p/
      retType = 'page';
      break;
    default:
      retType = 'skip';
      break;
  }

  return retType;
}

function showErrorMessage(jqXHR)
{
	var msg = '';
	if(jqXHR.status==0) { // internet connection broke  
        msg = 'internet connection broke';
    } else if(jqXHR.status==500) { // internal server error
    	msg = 'internal server error';
    } else {
    	msg = 'unknow error';
    }

    alert(msg);


}
$('.btnBSafes').click(function(e) {

	// check whether keys existed in localstorage.
	if ( ("encodedGold" in localStorage) && ("publicKey" in localStorage) && ("encodedPrivateKeyEnvelope" in localStorage) && ("encodedEnvelopeIV" in localStorage)) {
		navigateView('../../BSafes/views/teams.ejs');
	} else {
		navigateView('../../BSafes/views/managedMemberSignIn.ejs');
	}
})

$('.btnLocal').click(function(e) {
	navigateView('../../Local/views/teams.ejs');
})

$('.btnDownloads').click(function(e) {
	navigateView('../../Downloads/views/downloads.ejs');
})
