(function(){
	var memberSignedOut = false;

	$('.signOut').click(function(e) {
    memberSignedOut = true;
  });

	// clear & restore <bsafes_last_url> and <local_last_url>

	var bsafes_last_url = localStorage.getItem("bsafes_last_url"); 
	var local_last_url = localStorage.getItem("local_last_url");
	localStorage.clear();	
	localStorage.setItem("bsafes_last_url", bsafes_last_url); 
	localStorage.setItem("local_last_url", local_last_url);

	$.post(server_addr + '/isMemberSignedIn', {
	}, function(data, textStatus, jQxhr ){
		if(data.status === 'yes') {
			localStorage.setItem("isSignedIn", "true");
			setTimeout(checkState, 1000);	
		} else {
			window.location.reload(true);
		}
	}, 'json');
	
	function checkState() {
		if(memberSignedOut) {
      localStorage.clear();
      window.location.replace("/signOut");
      return;
    }

		var isSignedIn = localStorage.getItem("isSignedIn");
		if(isSignedIn && (isSignedIn === "true")) {
			console.log("signedIn");
			var isKeySetup = localStorage.getItem("encodedSearchKeyIV");
			var redirectURL = $('.redirectURL').text();
			if(redirectURL && (redirectURL !== 'undefined')) {
			
			} else {
				redirectURL = '/';
			}
			if(isKeySetup) {
				window.location.replace(redirectURL);
			}
			setTimeout(checkState, 1000);
		} else {
			window.location.replace("/");
		} 
	}
}());
