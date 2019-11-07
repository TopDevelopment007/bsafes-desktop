function loadPage(){
	var pki = forge.pki;
  var rsa = forge.pki.rsa;

	var currentKeyVersion = 1;

	var pki = forge.pki;
	var rsa = forge.pki.rsa;

	var memberId = $('.loginUserId').text();
	var expandedKey;
	var publicKeyPem;
	var privateKeyPem;
	var searchKey;

	var addAction = 'addATeamOnTop';
	var $addTargetTeam;

	var currentContentsPage = 1;
	var itemsPerPage = 20;

	var selectedTeams = [];

  $('.btnLog').addClass('hidden');

  $('.btnLog').click(function(e) {
      $(e.target).trigger('blur');
      var isModalVisible = $('#logDownloadItemsModal').is(':visible');
      if (!isModalVisible) {
          showDownloadItemsModal();
      }

      return false;
  });

  $("#logDownloadItemsModal").on('hide.bs.modal', function () {
    $modal_body = $(this).find('.modal-body');
    ipcRenderer.send( "saveLogModal", $modal_body.html() );
  });

  $('#logDownloadItemsModal').on('show.bs.modal', function() {
    $modal_body = remote.getGlobal('logModal');

    if ($modal_body != '') {
      $(this).find('.modal-body').html($modal_body);  
    }
    
  });

  var handleDeleteAction = function(e) {
    var $targetTeam = $(e.target).closest('.resultItem');
    var itemID = $targetTeam.attr('id');
    var rowId = $targetTeam.attr('rowId');

    //dbDeleteLogItem(itemID, function() {
    dbDeleteLogItem(rowId, function() {
      listTeams(1); 
    });
  }


	function updateToolbar(selectedTeams) {
    var $checkedItems = $('input:checked');
    var numberOfSelectedItems = selectedTeams.length;
    console.log('Selected Items:', numberOfSelectedItems);
    if(numberOfSelectedItems) {
      $('.itemActionBtn').removeClass('hidden disabled');
      $('.addItemBtn').addClass('hidden');
      $checkedItems.each(function(index, element) {
        $(element).closest('.resultItem').find('.itemActionBtn').addClass('disabled');
      });
      $("#btnDownload").removeClass('hidden');
    } else {
      $('.itemActionBtn').addClass('hidden');
			$('.addItemBtn').removeClass('hidden');
      $("#btnDownload").addClass('hidden');
    }
	}
	
	function displayTeams(teams) {
		function displayATeam() {
			var team = teams[i];
      var rowId = team._source.id;
			var teamId = team._source.teamId;
			var teamPosition = team._source.position;
      var teamName = team._source.teamName;
      var teamStatus = team._source.status;
      var logTime = team._source.logTime;

			function appendResult(thisTeamName) {
      	var $resultItem = $('.resultItemTemplate').clone().removeClass('resultItemTemplate hidden').addClass('resultItem');
      	$resultItem.attr('id', teamId);
        $resultItem.attr('rowId', rowId);
				$resultItem.data('position', teamPosition);
				thisTeamName = DOMPurify.sanitize(thisTeamName);
        thisTeamName = '<a hre="">' + thisTeamName + '</a>';
        thisType = checkItemType(teamId);
      	$resultItem.find('.itemTitle').html(thisTeamName);
        $resultItem.find('.itemStatus').html(teamStatus);
        $resultItem.find('.logTime').html(logTime);
        //$resultItem.find('.itemType').html(thisType);
      	var link = '/team/' + teamId;

        $resultItem.find('.deleteItemBtn').click(function(e) {
          e.preventDefault();
          handleDeleteAction(e);
          return false;
        });

        $resultItem.find('.resumeBtn').click(function(e) {
          e.preventDefault();
          //$('.stopBtn').removeClass('hidden');
          //$('.resumeBtn').addClass('hidden');
          ipcRenderer.send( "setDownloadStatus", false );
          return false;
        });

        $resultItem.find('.stopBtn').click(function(e) {
          e.preventDefault();
          //$('.resumeBtn').removeClass('hidden');
          //$('.stopBtn').addClass('hidden');
          ipcRenderer.send( "setDownloadStatus", true );
          return false;
        });
 
      	$('.resultItems').append($resultItem);
			}
      appendResult(teamName);
		}

		for ( var i=0; i < teams.length; i++) {
			displayATeam();
		}
    //console.log('ok');
    $('.btnLog').removeClass('hidden');
    intervalObj();
	}

  function resetPagination() {
    currentContentsPage = 1;
    $('.containerContentsPagination').empty();
    $('.containerContentsPagination').addClass('hidden');
  }

	function updatePagination(currentContentsPage, total, sizePerPage) {
    var $containerContentsPagination = $('.containerContentsPagination');
    if($containerContentsPagination.hasClass('hidden')) {
      var $leftArrowPagingItem = $('<li><a href="#">&laquo;</a></li>');
      var $rightArrowPagingItem = $('<li><a href="#">&raquo;</a></li>');
      var $numberPagingItem = $('<li><a href="#">1</a></li>');

      var numberOfContentsPages;
      var tempNumber = total/sizePerPage;
      if((tempNumber)%1 === 0) {
        numberOfContentsPages = tempNumber;
      } else {
        numberOfContentsPages = Math.floor(tempNumber) + 1;
      }

      for(var i=0; i< numberOfContentsPages; i++) {
        var $newItem = $numberPagingItem.clone();
        $newItem.attr('id', i+1);
        $newItem.find('a').text(i+1);
        $newItem.find('a').click(function(e){
          e.preventDefault();
          var intendedPageNumber = parseInt($(e.target).parent().attr('id'));
          listTeams(intendedPageNumber);
          return false;
        });
        $('.containerContentsPagination').append($newItem);
      }
      $('.containerContentsPagination').removeClass('hidden');
    }
    $('.containerContentsPagination').find('li.disabled').removeClass('disabled');
    $('.containerContentsPagination').find('li#'+ (currentContentsPage)).addClass('disabled');
  }

	/* List Section */
	var listTeams = function (pageNumber) {
		showLoading();
		$('.resultItems').empty();

		dbGetDownloadsItemsFromLogs( {from : (pageNumber-1)*itemsPerPage, size: itemsPerPage}, function(data) {
			if(data.status === 'ok') {
        currentContentsPage = pageNumber;
				var total = data.hits.total;
        var hits = data.hits.hits;
				if(hits.length) displayTeams(hits);
				updatePagination(currentContentsPage, total, itemsPerPage);
			}
			hideLoading();	
		});
	}


  listTeams(1);

  //var arrLogItems = [];

  function intervalObj()  
  {
    //console.log('interviewing the interval');
    // if (arrLogItems.length) {
    //   return;
    // }
    
    arrLogItems = $('.resultItem');

    function getItemStatus() {
      // if (arrLogItems.length == 0) {
      //   return;
      // }

      var isStopped = require('electron').remote.getGlobal('isStopped');
      if (isStopped) {
        $('.resumeBtn').removeClass('hidden');
        $('.stopBtn').addClass('hidden');
        
      } else {
        $('.stopBtn').removeClass('hidden');
        $('.resumeBtn').addClass('hidden');
      }

      var itemId = $(arrLogItems[i]).attr('id');
      var $item = $(arrLogItems[i]);
      //console.log('itemId', itemId);
      dbGetDownloadedCountInItem(itemId, function(err, total, downloaded, errors) {
        if (err) {
          console.log('err: dbGetDownloadedCountInItem', err);
        } else {
          var status = '';
          var remains = total - downloaded - errors;

          if (errors) {
            status = 'Downloaded : ' + downloaded + ', Errors : ' + errors + ' / Total : ' + total;
          } else {
            status = 'Downloaded : ' + downloaded + ' / Total : ' + total;
          }

          $item.find('.itemStatus').html(status); 
          if (remains == 0) {
            $item.find('.itemStatus').addClass('text-success');
            //$item.find('.progress-bar').addClass('hidden');
            $item.find('.progress-bar').remove();
            $item.find('.btn-group-status').remove();

          } else {
            var percent = (downloaded + errors) * 100 / total;
            $item.find('.progress-bar').attr('aria-valuenow', percent);
            $item.find('.progress-bar').css({'width':percent+'%'});
          }
          arrLogItems.splice( 0, 1 );   
          //getItemStatus();   
          //setTimeout(getItemStatus, 300);
        }
      });
    }

    for (var i=0; i<arrLogItems.length; i++) {
      getItemStatus();
    }

    setTimeout(intervalObj, 1000);
   
  }


  
};
