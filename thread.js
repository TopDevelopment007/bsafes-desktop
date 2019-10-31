var server_addr = 'https://www.openbsafes.com'
var download_folder_path = 'bsafes_downloads/';
var forge = require('node-forge');
var BSON = require('bson');
var moment = require('moment');
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const { ipcRenderer, remote } = require( "electron" );
var pki = forge.pki;
var rsa = forge.pki.rsa;
var privateKeyPem;
var arrPage = [];
var currentPage = null;
var stoppedPage = null;
var pageName = '';
var db = null;
var lastMsg = null;

var current_down_item = null;
var logObj = [];

var pageContentType = null;
var constContentTypeWrite = 'contentType#Write';
var constContentTypeDraw = 'contentType#Draw';
var constContentTypeSpreadsheet = 'contentType#Spreadsheet';
var constContentTypeDoc = 'contentType#Doc';
var constContentTypeMxGraph = 'contentType#MxGraph';

var isSopped = false;

setInterval(interval, 2000);

function interval()
{
	if (require('electron').remote == undefined) {
        return;
    }

	if (db == null) {
		db = require('electron').remote.getGlobal('sqliteDB');
		setSQLiteDB(db);
		
	}
    console.log('_______arrPage', arrPage.length);
    console.log('____currentPage', currentPage);
    console.log('____currentPageName', pageName);
    console.log('____stoppedPage', stoppedPage);

    var isStopped = require('electron').remote.getGlobal('isStopped');

    if (isStopped) {
        console.log('stopped...');
        return;
    } else {
        console.log('running...')
    }

    if (stoppedPage) {
        console.log('resume the stoppedPage...');
        currentPage = stoppedPage;
        stoppedPage = null;
        downloadPage(currentPage);

    } else if (currentPage == null)
    {
        dbGetDownloadsListFromPages(function(arrPageList){
            arrPage = arrPageList;
            if (arrPageList.length == 0) {
                saveLog( 'completed' );
                return;                
            }

            currentPage = arrPageList[0];   
            console.log('currentPage', currentPage);       
            dbUpdatePageStatus(currentPage, function(err, isCompleted) {
                if (isCompleted) {
                    currentPage = null;
                    return;
                } else {
                    if (currentPage) {
                        downloadPage(currentPage);    
                    }                    
                }
            });

        });
    } else {
        dbUpdatePageStatus(currentPage, function(err, isCompleted) {
            if (isCompleted) {
                currentPage = null;
                return;
            } 
        });
    }
}

function processErrors(jqXHR)
{
    var msg;
    if(jqXHR.status==0) { // internet connection broke  
        msg = 'internet connection broke';
        console.log(msg);
        stoppedPage = currentPage;
        ipcRenderer.send( "setDownloadStatus", true );
    } else if(jqXHR.status==500) { // internal server error
        msg = 'internal server error';
    } else {
        msg = 'unknow error';
    }

}

function downloadPage(pageId) 
{
	console.log('start downloading...', pageId);
    //saveLog(pageId + ' start downloading...', true);

    dbQueryInfo(server_addr + '/memberAPI/preflight', {
		sessionResetRequired: false
	}, function(data, textStatus, jQxhr ){
		if(data.status === 'ok'){
			privateKeyPem = data.privateKey;
			getPageItem(pageId, data.expandedKey, data.privateKey, data.searchKey, function(err, item) {
                if (err) {
                    //alert(err);
                    console.log('err_downloadPage', pageId);
                    dbUpdatePageStatusWithError(pageId);
                    currentPage = null;
                } else {
                    console.info('!!!_complete_downloadPage (pageId = )', pageId);
                    function waitForPageSettingTotalCounters(itemId)
                    {
                        dbCheckPageTotalCounters(itemId, function(isReady) {
                            if (!isReady) {
                                setTimeout(waitForPageSettingTotalCounters, 500, itemId );
                            } else {
                                checkIsCompletedThenSet(pageId);
                            }
                        })
                    }
                    waitForPageSettingTotalCounters(pageId);
                    
                }
                //currentPage = null;
            });
		}
	});

}


function getPageItem(thisItemId, thisExpandedKey, thisPrivateKey, thisSearchKey, done, thisVersion) {
    oldVersion = "undefined"
    if (!thisVersion) {
        expandedKey = thisExpandedKey;
        privateKey = thisPrivateKey;
        searchKey = thisSearchKey;
        itemId = thisItemId;
    }
    
    function getPageComments() {
    	var default_size = 100;
    	var return_size = 0;
		var return_data = {};
        
        $.post(server_addr + '/memberAPI/getPageComments', {        
            itemId: thisItemId,
            size: default_size,
            from: 0
        }, function(data, textStatus, jQxhr) {
            if (data.status === "ok") {
                var total = data.hits.total;
                var hits = data.hits.hits;

                if (default_size < total) {
					$.post(server_addr + '/memberAPI/getPageComments', {
						itemId: thisItemId,
						size: total,
						from: 0
					}, function(total_data, textStatus, jQxhr) {
						dbInsertPageContents(server_addr + '/memberAPI/getPageComments', thisItemId, total_data);
					});
				} else {
					dbInsertPageContents(server_addr + '/memberAPI/getPageComments', thisItemId, data);
				}
					
            } else {
            	console.log('err_getPageComments', 'none');
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown){
            processErrors(jqXHR);
        });
    } // end function
    
    var options = {
        itemId: thisItemId
    };
    if (thisVersion) {
        options.oldVersion = thisVersion;
    }

    $.post(server_addr + '/memberAPI/getPageItem', options, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
        	dbInsertPageContents(server_addr + '/memberAPI/getPageItem', thisItemId, data);

            if (data.item) {
                itemCopy = data.item;
                isBlankPageItem = false;

                var item = data.item;

                itemSpace = item.space;
                itemContainer = item.container;
                itemPosition = item.position;

                dbInsertDownloadList(itemContainer);

                function decryptItem(envelopeKey) {
                    console.log('decryptItem', thisItemId);
                    itemKey = decryptBinaryString(item.keyEnvelope, envelopeKey, item.envelopeIV);
                    itemIV = decryptBinaryString(item.ivEnvelope, envelopeKey, item.ivEnvelopeIV);
                    itemTags = [];
                    if (item.tags && item.tags.length > 1) {
                        var encryptedTags = item.tags;
                        for (var i = 0; i < (item.tags.length - 1); i++) {
                            try {
                                var encryptedTag = encryptedTags[i];
                                var encodedTag = decryptBinaryString(encryptedTag, itemKey, itemIV);
                                var tag = forge.util.decodeUtf8(encodedTag);
                                //itemTags.push(tag);
                                if (tag == constContentTypeWrite) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeDraw) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeSpreadsheet) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeDoc) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeMxGraph) {
                                    pageContentType = tag;
                                } else {
                                    itemTags.push(tag);
                                }
                            } catch (err) {
                                alert(err);
                            }
                        }
                        //$('#tagsInput').tokenfield('setTokens', itemTags);
                    } else {
                        pageContentType = constContentTypeWrite;
                    }
                    
                    $('.container').data('itemId', itemId);
                    $('.container').data('itemKey', itemKey);
                    $('.container').data('itemIV', itemIV);
                    var titleText = "";
                    if (item.title) {
                        try {
                            var encodedTitle = decryptBinaryString(item.title, itemKey, itemIV);
                            title = forge.util.decodeUtf8(encodedTitle);
                            title = DOMPurify.sanitize(title);
                            $('.froala-editor#title').html(title);
                            titleText = document.title = $(title).text();
                        } catch (err) {
                            alert(err);
                        }
                    } else {
                        $('.froala-editor#title').html('<h2></h2>');
                    }
                    pageName = titleText;

                    saveLog('< ' + pageName + '> started.');
                    //if (current_down_item) logObj.push(current_down_item);
                    current_down_item = {'itemId' : thisItemId, 'itemName' : pageName, logs : [] };
                    current_down_item.logs.push();
                    //getAndShowPath(thisItemId, envelopeKey, teamName, titleText);
                    getAndShowPath(thisItemId, envelopeKey, titleText);
                    var item_content = '';
                    var content = null;
                    if (item.content) {
                        try {
                            var encodedContent = decryptBinaryString(item.content, itemKey, itemIV);
                            content = forge.util.decodeUtf8(encodedContent);
                            DOMPurify.addHook('afterSanitizeAttributes', function(node) {
                                // set all elements owning target to target=_blank
                                if ('target'in node) {
                                    node.setAttribute('target', '_blank');
                                }
                                // set non-HTML/MathML links to xlink:show=new
                                if (!node.hasAttribute('target') && (node.hasAttribute('xlink:href') || node.hasAttribute('href'))) {
                                    node.setAttribute('xlink:show', 'new');
                                }
                            });
                            content = DOMPurify.sanitize(content);
                            item_content = content;
                            //$('.froala-editor#content').html(content);
                            if ( content && (pageContentType == null) ) { // old case...
                                pageContentType = constContentTypeWrite;
                            }
                        } catch (err) {
                            alert(err);
                        }
                        //downloadContentImageObjects(item_content, thisItemId);
                        //handleVideoObjects(item_content, thisItemId);
                    } else {
                        dbSetTotalCountersOfPage(itemId, 'ContentsImage', 0);
                        dbSetTotalCountersOfPage(itemId, 'Video', 0);
                    }
                    

                    if (item.images && item.images.length) {
                        dbSetTotalCountersOfPage(itemId, 'Image', item.images.length);
                    } else {
                        dbSetTotalCountersOfPage(itemId, 'Image', 0);
                    }

                    if (item.images && item.images.length) {
                        function downloadAndDisplayImages() {
                            //$('.imageBtnRow').addClass('hidden');

                            function buildDownloadImagesList() {
                                var images = item.images;
                                var $lastElement = $('.imageBtnRow');
                                for (var i = 0; i < images.length; i++) {
                                    $downloadImage = $('.downloadImageTemplate').clone().removeClass('downloadImageTemplate hidden').addClass('downloadImage');
                                    var id = 'index-' + i;
                                    $downloadImage.attr('id', id);
                                    var s3Key = images[i].s3Key;
                                    var words = images[i].words;
                                    $downloadImage.data('s3Key', s3Key);
                                    $downloadImage.data('words', words);
                                    $downloadImage.find('.downloadText').text("");
                                    $lastElement.after($downloadImage);
                                    $lastElement = $downloadImage;
                                }
                            }
                            
                            function startDownloadingImages(done) {
                                var $downloadImagesList = $('.downloadImage');
                                var index = 0;

                                function downloadAnImage(done) {
                                    $downloadImage = $($downloadImagesList[index]);
                                    $downloadImage.find('.downloadText').text("Downloading");
                                    var id = $downloadImage.attr('id');
                                    // var s3CommonKey = $downloadImage.data('s3Key');
                                    // var s3Key = s3CommonKey + "_gallery";
                                    var images = item.images;
                                    var s3CommonKey = images[index].s3Key;
                                    var s3Key = s3CommonKey + "_gallery";

                                    $.post(server_addr + '/memberAPI/preS3Download', {
                                        itemId: itemId,
                                        s3Key: s3Key
                                    }, function(data, textStatus, jQxhr) {
                                        if (data.status === 'ok') {
                                        	dbInsertPageIamge(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data);
                                            var signedURL = data.signedURL;

                                            var xhr = new XMLHttpRequest();
                                            xhr.open('GET', signedURL, true);
                                            xhr.responseType = 'arraybuffer';

                                            xhr.addEventListener("progress", function(evt) {
                                                if (evt.lengthComputable) {
                                                    var percentComplete = evt.loaded / evt.total * 100;
                                                    $downloadImage.find('.progress-bar').css('width', percentComplete + '%');
                                                    saveLog('Image downloading : ' + percentComplete + '%', s3Key);
                                                    console.log('****edi_image download' + s3Key + ':' + percentComplete);
                                                }
                                            }, false);

                                            xhr.onload = function(e) {
                                                $downloadImage.find('.downloadText').text("Decrypting");
                                                //currentImageDownloadXhr = null;
                                                var encryptedImageDataInArrayBuffer = this.response;
                                                var buffer = this.response;
                                                var file_name = uuidv1();
												fs.open(download_folder_path + file_name, 'w', function(err, fd) {
												    if (err) {
												        throw 'could not open file: ' + err;
												    }
												    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
												    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
												        if (err) throw 'error writing file: ' + err;
												        dbInsertPageIamge(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data='', file_name);
                                                        updatePageStatus(itemId, 'Image');
												        fs.close(fd, function() {
												            console.log('wrote the Image file successfully');
												        });
												    });
												});

                                                done(null);

                                            }

                                            xhr.onerror = function (e) {
                                                dbUpdatePageStatusWithError(itemId);
                                                //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                                                console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                                                saveLog('Ooh, Error occured');
                                                processErrors(null);
                                            };
                                            
                                            xhr.send();

                                        }
                                    }, 'json');

                                }
                                
                                var doneDownloadingAnImage = function(err) {
                                    if (err) {
                                        console.log(err);
                                        done(err);
                                    } else {
                                        index++;
                                        //if (index < $downloadImagesList.length) {
                                        if (index < item.images.length) {
                                            downloadAnImage(doneDownloadingAnImage);
                                        } else {
                                            done(null);
                                        }
                                    }
                                };

                                downloadAnImage(doneDownloadingAnImage);
                            }
                            
                            buildDownloadImagesList();
                            startDownloadingImages(function(err) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    //$('.imageBtnRow').removeClass('hidden');
                                }
                            });

                        }                        
                        downloadAndDisplayImages();
                    }

                    var attachments = item.attachments;
                    dbSetTotalCountersOfPage(itemId, 'Attatchment', attachments.length-1);
                    for (var i = 1; i < attachments.length; i++) {
                        var attachment = attachments[i];
                        var encodedFileName = decryptBinaryString(attachment.fileName, itemKey, itemIV);
                        var fileName = forge.util.decodeUtf8(encodedFileName);
                        //var $attachment = showAttachment(fileName, attachment.size);
                        //$attachment.attr('id', attachment.s3KeyPrefix);
                        //changeDownloadingState($attachment, 'Attached');
                        //var $download = $attachment.find('.downloadBtn');
                        //$download.off();
                        //$download.click(queueDownloadEvent);
                        downloadAttachment(attachment.s3KeyPrefix);
                    }
                    if (!thisVersion || thisVersion === currentVersion) {
                        //enableEditControls();
                        /* initializeEditorButtons();
						initializeImageButton();
          				initializeAttachButton();
						*/
                    } else {
                        //disableEditControls();
                    }
                    initContentView(content);
                } // end function decryptItem()

                if (itemSpace.substring(0, 1) === 'u') {
                    $('.navbarTeamName').text("Yours");
                    decryptItem(expandedKey);
                    getPageComments();
                    done(null, item);
                } else {
                    isATeamItem = true;
                    var itemSpaceParts = itemSpace.split(':');
                    itemSpaceParts.splice(-2, 2);
                    teamId = itemSpaceParts.join(':');
                    getTeamData(teamId, function(err, team) {
                        if (err) {
                            done(err, item);
                        } else {
                            var teamKeyEnvelope = team.teamKeyEnvelope;
                            teamKey = pkiDecrypt(teamKeyEnvelope);
                            var encryptedTeamName = team.team._source.name;
                            var teamIV = team.team._source.IV;
                            teamName = decryptBinaryString(encryptedTeamName, teamKey, teamIV);
                            teamName = forge.util.decodeUtf8(teamName);
                            teamName = DOMPurify.sanitize(teamName);

                            if (teamName.length > 20) {
                                var displayTeamName = teamName.substr(0, 20);
                            } else {
                                var displayTeamName = teamName;
                            }

                            $('.navbarTeamName').text(displayTeamName);

                            var teamSearchKeyEnvelope = team.team._source.searchKeyEnvelope;
                            var teamSearchKeyIV = team.team._source.searchKeyIV;

                            teamSearchKey = decryptBinaryString(teamSearchKeyEnvelope, teamKey, teamSearchKeyIV);
                            //setIsATeamItem(teamKey, teamSearchKey);

                            decryptItem(teamKey);
                            getPageComments();
                            done(null, item);
                        }
                    });
                }
            } else {
                
                if ((itemId.substring(0, 2) === 'np') || (itemId.substring(0, 2) === 'dp')) {
                    itemIdParts = itemId.split(':');

                    if (itemId.substring(0, 2) === 'np') {
                        itemContainer = 'n';
                        itemPosition = Number(itemIdParts[itemIdParts.length - 1]);
                    } else if (itemId.substring(0, 2) === 'dp') {
                        itemContainer = 'd';
                        var dateText = itemIdParts[itemIdParts.length - 1];
                        dateText = dateText.replace(/-/g, "");
                        itemPosition = Number(dateText);
                    }
                    for (var i = 1; i < itemIdParts.length - 1; i++) {
                        itemContainer = itemContainer + ':' + itemIdParts[i];
                    }
                    //setupContainerPageKeyValue('itemPosition', itemPosition);
                    isBlankPageItem = true;
                    getPath(itemContainer, itemId, function(itemPath) {
                        itemSpace = itemPath[0]._id;

                        if (itemSpace.substring(0, 1) === 't') {
                            isATeamItem = true;

                            var itemSpaceParts = itemSpace.split(':');
                            itemSpaceParts.splice(-2, 2);
                            teamId = itemSpaceParts.join(':');
                            getTeamData(teamId, function(err, team) {
                                if (err) {
                                    done(err);
                                } else {
                                    var teamKeyEnvelope = team.teamKeyEnvelope;
                                    teamKey = pkiDecrypt(teamKeyEnvelope);
                                    var encryptedTeamName = team.team._source.name;
                                    var teamIV = team.team._source.IV;
                                    teamName = decryptBinaryString(encryptedTeamName, teamKey, teamIV);
                                    teamName = forge.util.decodeUtf8(teamName);
                                    teamName = DOMPurify.sanitize(teamName);
                                    var teamSearchKeyEnvelope = team.team._source.searchKeyEnvelope;
                                    var teamSearchKeyIV = team.team._source.searchKeyIV;
                                    teamSearchKey = decryptBinaryString(teamSearchKeyEnvelope, teamKey, teamSearchKeyIV);
                                    $('.pathSpace').find('a').html(teamName);
                                    //showPath(teamName, itemPath, itemContainer, teamKey, itemId);

                                    setupNewItemKey();
                                    console.log('err1');
                                    done(null, null);
                                }
                            });
                        } else {
                            setupNewItemKey();
                            //showPath('Personal', itemPath, itemContainer, expandedKey, itemId);
                            console.log('err2');
                            done(null, null);
                        }
                    });
                } else {
                    console.log('err3');
                    done(null, null);
                }
            }
        } else {
            console.log('err4_getPageItem', data.error, thisItemId);
            done(data.error, null)
        }
        
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
}


function getTeamData(teamId, done) {
	$.post(server_addr + '/memberAPI/getTeamData', {
		teamId: teamId
	}, function(data, textStatus, jQxhr) {
		if(data.status === 'ok') {
            dbInsertTeams(server_addr + '/memberAPI/getTeamData', teamId, data);
            dbInsertDownloadList(teamId);
			done(null, data.team);      		
		} else {
            console.log('err4_getTeamData');
			done(data.error, null);
      		console.log('err:(getTeamData)', data.error);
		}
	}, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
};	

var pkiDecrypt = function(encryptedData) {
    var privateKeyFromPem = pki.privateKeyFromPem(privateKeyPem);
    var decryptedData = privateKeyFromPem.decrypt(encryptedData);
    var decodedData = forge.util.decodeUtf8(decryptedData);
    return decodedData;
}

function getPath(itemId, pageId, done) {
	$.post(server_addr + '/memberAPI/getItemPath', {
		itemId: itemId
	}, function(data, textStatus, jQxhr) {
		if(data.status === 'ok') {
			var path = data.itemPath;
			dbInsertItemPath(server_addr + '/memberAPI/getItemPath', itemId, data);
			done(path);
		} else {
            console.log('err5');
        }
	})
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
};

//function getAndShowPath(itemId, envelopeKey, teamName, endItemTitle) {
function getAndShowPath(itemId, envelopeKey, endItemTitle) {
	$.post(server_addr + '/memberAPI/getItemPath', {
		itemId: itemId 
	}, function(data, textStatus, jQxhr) {
		if(data.status === 'ok') {
			dbInsertItemPath(server_addr + '/memberAPI/getItemPath', itemId, data);
			//showPath(teamName, data.itemPath, itemId, envelopeKey, null ,endItemTitle);
		} else {
            console.log('err6');
        }
	}, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
}

function downloadContentImageObjects(item_content, itemId) {
    downloadNextContentImageObject(item_content, itemId);
}
;
function downloadNextContentImageObject(item_content, itemId) {

    var encryptedImages = $(item_content).find(".bSafesImage");

    dbSetTotalCountersOfPage(itemId, 'ContentsImage', encryptedImages.length);
    for (var i = 0; i < encryptedImages.length; i++) {
        downloadImageObject($(encryptedImages[i]), itemId);
    }

}
;
function downloadImageObject(encryptedImageElement, itemId) {
    currentDownloadingImageElement = encryptedImageElement;
    currentDownloadingImageElement.addClass('bSafesDownloading');

    var id = currentDownloadingImageElement.attr('id');

    var s3CommonKey = id.split('&')[0];
    var s3Key = s3CommonKey + '_gallery';

    function displayImage(link) {
        var targetElement = $(document.getElementById(id));

        targetElement.on('load', function() {
            targetElement.addClass('bSafesDisplayed');
            var parent = targetElement.parent();
            if (parent.hasClass('downloadingImageContainer'))
                parent.replaceWith(targetElement);
        });
        targetElement.attr('src', link);
    }

    $.post(server_addr + '/memberAPI/preS3Download', {
        itemId: itemId,
        s3Key: s3Key
    }, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
            var signedURL = data.signedURL;
            var isDownloaded = false;

            var xhr = new XMLHttpRequest();
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';

            xhr.addEventListener("progress", function(evt) {
                if (evt.lengthComputable) {
                    var percentComplete = evt.loaded / evt.total * 100;

                    $(document.getElementById('progressBar' + id)).width(percentComplete + '%');
                }
            }, false);

            xhr.onload = function(e) {
				var buffer = this.response;
				var file_name = uuidv1();
                isDownloaded = true;

				fs.open(download_folder_path + file_name, 'w', function(err, fd) {
				    if (err) {
				        throw 'could not open file: ' + err;
				    }
				    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
				    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
				        if (err) throw 'error writing file: ' + err;
				        dbInsertPageContentsFiles(server_addr + '/memberAPI/preS3Download', itemId, s3Key, file_name);
                        updatePageStatus(itemId, 'ContentsImage');
				        fs.close(fd, function() {
				            console.log('wrote the ContentsImage file successfully');
				        });
				    });
				});

                var encryptedImageDataInArrayBuffer = this.response;
               	

                $(document.getElementById('progressBar' + id)).parent().remove();
                $.post(server_addr + '/memberAPI/postS3Download', {
                    itemId: itemId,
                    s3Key: s3CommonKey
                }, function(data, textStatus, jQxhr) {
                    if (data.status === 'ok') {
                        var item = data.item;
                        var size = item.size;

                        var decryptedImageDataInUint8Array = decryptArrayBuffer(encryptedImageDataInArrayBuffer, itemKey, itemIV);
                        var link = window.URL.createObjectURL(new Blob([decryptedImageDataInUint8Array]), {
                            type: 'image/jpeg'
                        });
                        $downloadedElement = $(document.getElementById(id));
                        $downloadedElement.removeClass('bSafesDownloading');
                        displayImage(link);
                    } else {
                        console.log('err6');
                    }
                }, 'json')
                .fail(function(jqXHR, textStatus, errorThrown){
                    processErrors(jqXHR);
                });;
            }
            ;
            xhr.onerror = function (e) {
                dbUpdatePageStatusWithError(itemId);
                //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                saveLog('Ooh, Error occured');
                if (isDownloaded) processErrors(null);
            };

            xhr.send();

        }
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
}

function downloadVideoObject($videoDownload) {
    $videoDownload.off('click');
    $videoDownload.addClass('bSafesDownloading');
    var id = $videoDownload.attr('id');
    var s3Key = $videoDownload.attr('id').split('&')[0];

    // if (!currentEditor) {
    //     attachProgressBar($videoDownload);
    // }

    $.post(server_addr + '/memberAPI/preS3Download', {
        itemId: itemId,
        s3Key: s3Key
    }, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
            dbInsertPageVideo(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data);
            var signedURL = data.signedURL;

            var xhr = new XMLHttpRequest();
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';

            xhr.addEventListener("progress", function(evt) {
                if (evt.lengthComputable) {
                    var percentComplete = evt.loaded / evt.total * 100;

                    console.log('downloadVideoObject', percentComplete);
                    $(document.getElementById('progressBar' + id)).width(percentComplete + '%');
                }
            }, false);

            xhr.onload = function(e) {
                var buffer = this.response;
                var file_name = uuidv1();
                fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                    if (err) {
                        throw 'could not open file: ' + err;
                    }
                    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                        if (err) throw 'error writing file: ' + err;
                        //dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, current_chunkIndex, id, data='', file_name);
                        dbInsertPageVideo(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data='', file_name);
                        updatePageStatus(itemId, 'Video');
                        fs.close(fd, function() {
                            console.log('wrote the Video file successfully');
                        });
                    });
                });

                // $(document.getElementById('progressBar' + id)).parent().remove();
                // var encryptedVideoDataInArrayBuffer = this.response;

                // decryptArrayBufferAsync(encryptedVideoDataInArrayBuffer, itemKey, itemIV, function(data) {
                //     videoBlob = new Blob([data],{
                //         type: "video/mp4"
                //     });
                //     videoLink = window.URL.createObjectURL(videoBlob);

                //     var $videoSpan = $('<span class="fr-video fr-draggable" contenteditable="false" draggable="true"><video class="bSafesVideo fr-draggable fr-dvi fr-fvc" controls="">Your browser does not support HTML5 video.</video></span>');
                //     var $video = $videoSpan.find('video');
                //     $video.attr('id', id);
                //     $video.attr('src', videoLink);
                //     var style = $videoDownload.attr('style');
                //     $video.attr('style', style);

                //     if ($videoDownload.hasClass('fr-dib'))
                //         $videoSpan.addClass('fr-dvb');
                //     if ($videoDownload.hasClass('fr-dii'))
                //         $videoSpan.addClass('fr-dvi');
                //     if ($videoDownload.hasClass('fr-fil'))
                //         $videoSpan.addClass('fr-fvl');
                //     if ($videoDownload.hasClass('fr-fic'))
                //         $videoSpan.addClass('fr-fvc');
                //     if ($videoDownload.hasClass('fr-fir'))
                //         $videoSpan.addClass('fr-fvr');

                //     var $targetElement = $(document.getElementById(id));
                //     // jQuery doesn't accept slashes in selector
                //     var $parent = $targetElement.parent();
                //     $parent.replaceWith($videoSpan);

                // });
            }
            ;

            xhr.send();

        } else {
            console.log('err6');
        }
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
}
;
function handleVideoObjects(item_content, itemId) {

    var videoDownloads = $(item_content).find(".bSafesDownloadVideo");

    dbSetTotalCountersOfPage(itemId, 'Video', videoDownloads.length);
    for (var i = 0; i < videoDownloads.length; i++) {
        downloadVideoObject($(videoDownloads[i]));
    }
}

function isImageDisplayed(imageElement) {
    var src = imageElement.attr('src');
    return src.indexOf('blob:') === 0;
}

var downloadAttachment = function(id) {
    //e.preventDefault();
    //var $downloadAttachment = $(e.target).parent();
    //var $attachment = $downloadAttachment.closest('.attachment');
    //var id = $attachment.attr('id');
    var fileName;
    var fileType;
    var fileSize;
    var numberOfChunks;
    var chunkIndex = 0;
    var decryptChunkIndex = 0;
    var decryptedFileInUint8Array;
    var decryptedFileIndex;
    var $decryptChunkDeferred = $.Deferred();
    var $decryptChunkPromise = $decryptChunkDeferred.promise();
    $decryptChunkDeferred.resolve();
    console.log('Download ', id);

    var downloadedFileProgress = 0;
    var $progress = $('.attachmentProgressTemplate').clone().removeClass('attachmentProgressTemplate hidden').addClass('attachmentProgressRow');
    //$progress.find('.progress-bar').css('width', 0);
    //$attachment.after($progress);

    //changeDownloadingState($attachment, 'Downloading');

    function downloadDecryptAndAssemble() {

        function enableResume() {
            //changeDownloadingState($attachment, 'Stopped');
            var $resume = $attachment.find('.resumeBtn');
            $resume.off();
            $resume.click(function(e) {
                console.log('resuming downloading chunk:', chunkIndex);
                //changeDownloadingState($attachment, 'Downloading');
                downloadDecryptAndAssemble();
            });
        }

        function downloadAChunk(signedURL) {
            var xhr = new XMLHttpRequest();
            var isDownloaded = false;
            
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';

            var attachmentFileProgress = 0;
            var previousProgress = 0;
            var timer;

            var timeout = function() {
                if (xhr) {
                    if (attachmentFileProgress === previousProgress) {
                        xhr.abort();
                    } else {
                        previousProgress = attachmentFileProgress;
                        timer = setTimeout(timeout, 10000);
                    }
                }
            };
            timer = setTimeout(timeout, 10000);

            xhr.addEventListener("progress", function(evt) {
                //console.log('isDownloaded:', isDownloaded);
                if (isDownloaded)
                    return;
                if (evt.lengthComputable) {
                    attachmentFileProgress = downloadedFileProgress + (evt.loaded / evt.total * 100) / numberOfChunks;
                    attachmentFileProgress = Math.floor(attachmentFileProgress * 100) / 100;
                    console.log('******file progress:', id, attachmentFileProgress);
                    saveLog('Attachment downloading : ' + attachmentFileProgress + '%', id);
                }
            }, false);

            xhr.onload = function(e) {
            	var buffer = this.response;
				var file_name = uuidv1();
				var current_chunkIndex = chunkIndex;
				fs.open(download_folder_path + file_name, 'w', function(err, fd) {
				    if (err) {
				        throw 'could not open file: ' + err;
				    }
				    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
				    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
				        if (err) throw 'error writing file: ' + err;
                        console.log('dbInsertPageAttatchment(chunkIndex)', chunkIndex)
				        dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, current_chunkIndex, id, data='', file_name);
                        
				        fs.close(fd, function() {
				            console.log('wrote the Attatchment file successfully');
				        });
				    });
				});

                var encryptedChunkInArrayBuffer = this.response;
                isDownloaded = true;
                console.log('isDownloaded:', isDownloaded);

                console.log('downloaded chunk size:', encryptedChunkInArrayBuffer.byteLength);
                console.log('Chunk downloaded:', chunkIndex);

                $decryptChunkPromise.done(function() {
                    chunkIndex++;
                    downloadedFileProgress = chunkIndex / numberOfChunks * 100;
                    if (chunkIndex < numberOfChunks)
                        downloadDecryptAndAssemble();
                    console.log('Decrypt Chunk:', decryptedFileIndex);
                    $decryptChunkDeferred = $.Deferred();
                    $decryptChunkPromise = $decryptChunkDeferred.promise();
                    decryptChunkInArrayBufferAsync(encryptedChunkInArrayBuffer, decryptedFileInUint8Array, decryptedFileIndex, itemKey, itemIV, function(err, decryptedChunkSize) {

                        if (err) {
                            alert(err);
                            $decryptChunkDeferred.reject();
                        } else {
                            //console.log('decryptedChunkSize', decryptedChunkSize);
                            decryptedFileIndex += decryptedChunkSize;
                            decryptChunkIndex += 1;
                            //console.log(decryptedFileIndex);
                            if (decryptChunkIndex === numberOfChunks) {
                                isDownloading = false;
                                updatePageStatus(itemId, 'Attatchment');
                                console.log('____attatchement completed');
                            }
                            $decryptChunkDeferred.resolve();
                        }
                    });
                });
            }
            ;

            xhr.onerror = xhr.onabort = function() {
                console.log('isDownloaded:', isDownloaded);
                if (isDownloaded)
                    return;
                enableResume();
            }
            ;

            xhr.send();
        }

        $.post(server_addr + '/memberAPI/preS3ChunkDownload', {
            itemId: itemId,
            chunkIndex: chunkIndex.toString(),
            s3KeyPrefix: id
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
            	dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, chunkIndex, id, data);
                console.log(data);
                if (chunkIndex === 0) {
                    var encodedFileName = decryptBinaryString(data.fileName, itemKey, itemIV);
                    //fileName = forge.util.decodeUtf8(encodedFileName);
                    fileType = data.fileType;
                    fileSize = data.fileSize;
                    numberOfChunks = parseInt(data.numberOfChunks);
                    console.log('numberOfChunks', numberOfChunks);
                    decryptedFileInUint8Array = new Uint8Array(fileSize);
                    decryptedFileIndex = 0;
                }
                downloadAChunk(data.signedURL);
            } else {
                console.log('err6');
            }
        }, 'json')
        .fail(function(jqXHR, textStatus, errorThrown){
            processErrors(jqXHR);
        });
        ;
    }

    downloadDecryptAndAssemble();

    return false;
}

function updatePageStatus(pageId, field)
{
    dbIncreaseDownloadedCountersOfPage(pageId, field, function(){
        checkIsCompletedThenSet(pageId);      
    });
}

function checkIsCompletedThenSet(pageId)
{
    console.log('__checkIsCompletedThenSet', pageId);
    dbUpdatePageStatus(pageId, function(err, isCompleted) {
        if ( (!err) && (isCompleted) ){
            console.info('!!!_complete_checkIsCompletedThenSet (pageId = )', pageId);
            saveLog('< ' + pageName + ' > finished.');
            
            currentPage = null;
        }
    });
}

function saveLog(message, skey='', isDevMsg=false)
{
    var logMesage;
    var isDev;
    if ((lastMsg == message)) {
        return;
    }

    if (require('electron').remote != undefined) {
        isDev = require('electron').remote.getGlobal('isDev');
        //if ( (isDev) || (!isDevMsg) ) 
        {
            var letter = {};
            letter.logTime = moment().format('YYYY-MM-DD hh:mm');
            letter.message = message;
            letter.skey = skey;
            ipcRenderer.send( "sendDownloadMessage", letter );
            lastMsg = message;
        }
        //console.log('logMesage', require('electron').remote.getGlobal('logMesage'));
    } 
}

function initContentView(contentFromeServer)
{
    var pageLocalStorageContent = null;

    var content = null;
    $downloadContent = null;

    console.log('starting_initContentView');

    //showCanvasLoadingPage();

    // check localstorage content
    function getKeyContentFromLocalStorage() {
        if (localStorage.getItem(itemId + constContentTypeWrite)) {
            pageLocalStorageKey = itemId + constContentTypeWrite;
        } else if (localStorage.getItem(itemId + constContentTypeDraw)) {
            pageLocalStorageKey = itemId + constContentTypeDraw;
        } else if (localStorage.getItem(itemId + constContentTypeSpreadsheet)) {
            pageLocalStorageKey = itemId + constContentTypeSpreadsheet;
        } else if (localStorage.getItem(itemId + constContentTypeDoc)) {
            pageLocalStorageKey = itemId + constContentTypeDoc;
        } else if (localStorage.getItem(itemId + constContentTypeMxGraph)) {
            pageLocalStorageKey = itemId + constContentTypeMxGraph;
        } 

        if (pageLocalStorageKey != null) {
            // found LocalStorage item...
            pageLocalStorageContent = localStorage.getItem(pageLocalStorageKey);
            //console.log('pageLocalStorageContent = ', pageLocalStorageContent);
        }
    }

    //getKeyContentFromLocalStorage();
    
    // next get contents        
    if ( (pageContentType == null) && (pageLocalStorageContent == null) )  {
        //addSelectContentTypeView();    
        //hideCanvasLoadingPage();
    } else {
        startGettingContent(function(err) {    
            //if ($downloadContent) $downloadContent.remove();
            console.log('finish_startGettingContent');

            if (err) {
                //hideCanvasLoadingPage();
                console.log(err);
                alert(err);
            } else {                    
                var content_data = content;
                var isLocalStorage ;
                //console.log('currentVersion = ', currentVersion);
                //console.log('oldVersion = ', oldVersion);

                // if (oldVersion == '1') {
                //     $('.widgetIcon').addClass('hidden');
                // } else {
                //     $('.widgetIcon').removeClass('hidden');
                // }
                
                // if (isOldVersion()) {
                //     isLocalStorage = false;
                // } else {
                //     isLocalStorage = isLoadFromLocalStorage();
                // }

                // if (isLocalStorage) {
                //     content_data = pageLocalStorageContent;
                //     if (pageContentType == constContentTypeWrite) {
                //         flgIsLoadingFromLocalStorageForWrite = true;
                //     }
                // } 

                // loadLibrayJsCss(pageContentType, function(err) {      
                //     if (pageContentType == null) {
                //         addSelectContentTypeView();
                //     } else {
                //         loadDataInContentView(content_data);
                //         $('.contentContainer').removeClass('hidden');    
                //     }
                    
                //     hideCanvasLoadingPage();
                // }); 
                
            }
        });
    }

    function startGettingContent(doneGetting) {

        function getWriteTypesContent(done) {
            content = contentFromeServer;
            contentsFromServer = contentFromeServer;            
            downloadContentImageObjects(contentFromeServer, itemId);
            handleVideoObjects(contentFromeServer, itemId);
            done(null);
        }

        function downloadOtherTypesContent(done) {
            // $downloadContent = addTemplateOtherTypesStatusAndProgress();
            // $downloadContent.find('.downloadText').text("Downloading");
            // $downloadContent.find('.progress-bar').css('width', '0%');                
            // var id = $downloadImage.attr('id');
            // var s3CommonKey = $downloadImage.data('s3Key');
            //var s3Key = s3CommonKey + "_gallery";
            var s3Key = contentFromeServer;
            console.log('download_s3Key = ', s3Key);

            if (s3Key == null) {
                done(null); // this is version 1...
                return;
            }

            $.post(server_addr + '/memberAPI/preS3Download', {
                itemId: itemId,
                s3Key: s3Key
            }, function(data, textStatus, jQxhr) {
                console.log('call_preS3Download = ', data.status);
                if (data.status === 'ok') {
                    var signedURL = data.signedURL;
                    console.log('signedURL = ', signedURL);

                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', signedURL, true);
                    xhr.responseType = 'arraybuffer';

                    // xhr.addEventListener("progress", function(evt) {
                    //     if (evt.lengthComputable) {
                    //         var percentComplete = evt.loaded / evt.total * 100;
                    //         //$downloadImage.find('.progress-bar').css('width', percentComplete + '%');
                    //         $downloadContent.find('.progress-bar').css('width', percentComplete + '%');
                    //         //console.log('xhr_download progress = ', percentComplete + '%');
                    //     }
                    // }, false);

                    xhr.onload = function(e) {
                        //$downloadContent.find('.downloadText').text("Decrypting");
                        // $downloadImage.find('.downloadText').text("Decrypting");
                        // currentImageDownloadXhr = null;
                        var buffer = this.response;
                        var file_name = uuidv1();
                        fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                            if (err) {
                                throw 'could not open file: ' + err;
                            }
                            // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                            fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                                if (err) throw 'error writing file: ' + err;
                                dbInsertPageOtherTypesContentFiles(server_addr + '/memberAPI/preS3Download', itemId, s3Key, file_name);
                                updatePageStatus(itemId, 'OtherTypesContent');
                                fs.close(fd, function() {
                                    console.log('wrote the ContentsImage file successfully');
                                });
                            });
                        });

                        var encryptedContentDataInArrayBuffer = this.response;
                        $.post(server_addr + '/memberAPI/postS3Download', {
                            itemId: itemId,
                            s3Key: s3Key
                        }, function(data, textStatus, jQxhr) {
                            console.log('call_postS3Download = ', data.status);
                            if (data.status === 'ok') {
                                var item = data.item;
                                var size = item.size;

                                var decryptedContentDataInUint8Array = decryptArrayBuffer(encryptedContentDataInArrayBuffer, itemKey, itemIV);
                                function ab2str(buf) {
                                    //return String.fromCharCode.apply(null, new Uint8Array(buf));
                                    var str = new TextDecoder("utf-8").decode(buf);
                                    return str;
                                }
                                var arraybufferContent = decryptedContentDataInUint8Array;
                                arraybufferContent = ab2str(arraybufferContent);
                                content = arraybufferContent;
                                //console.log('decryptedContentDataInUint8Array = ', decryptedContentDataInUint8Array);
                                //console.log('arraybufferContent=', arraybufferContent);
                                done(null);
                            }
                        }, 'json');

                    };

                    xhr.onerror = function (e) {
                        dbUpdatePageStatusWithError(itemId);
                        //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                        console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                        saveLog('Ooh, Error occured');
                    };

                    xhr.onreadystatechange = function() {
                        if (xhr.status == 400) { // bad request
                            dbUpdatePageStatusWithError(itemId);
                            xhr.abort();
                            console.log('Ooh, bad data! It is bad URL request : \n', signedURL);
                        } else {
                            //alert('Ooh, bad data! It occurred when requesting : \n', signedURL);
                        }
                    };

                    xhr.send();
                    //currentImageDownloadXhr = xhr;

                } else {
                    dbUpdatePageStatusWithError(itemId);
                }
            }, 'json')
            .fail(function(jqXHR, textStatus, errorThrown){
                processErrors(jqXHR);
            });

        };
        
        if ( (contentFromeServer == null) || (pageContentType == null) ){
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 0);
            doneGetting(null);
        } else if (pageContentType == constContentTypeWrite) {
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 0);
            getWriteTypesContent(doneGetting);
        } else {
            dbSetTotalCountersOfPage(itemId, 'ContentsImage', 0);
            dbSetTotalCountersOfPage(itemId, 'Video', 0);
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 1);
            downloadOtherTypesContent(doneGetting);
        }
    }

    function isLoadFromLocalStorage() {
        if (pageLocalStorageContent == null) {
            return false;
        }
        console.log('isLoadFromLocalStorage(pageLocalStorageKey)',pageLocalStorageKey);
        console.log('isLoadFromLocalStorage(itemId)',itemId);
        if ( (pageContentType == null) || (pageLocalStorageKey == itemId + pageContentType) ) {
            if (content != pageLocalStorageContent) {
                if (confirm('Found item contents in Local Storage.\nWould you like to recover the content from local storage?')) {
                    pageContentType = pageLocalStorageKey.replace(itemId, '');
                    console.log('pageContentType from localstorage', pageContentType);
                    return true;
                } else {
                    localStorage.removeItem(pageLocalStorageKey);
                }
            }            
        }
        return false;
    }
              
}
