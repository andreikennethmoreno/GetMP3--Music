function showLoadingScreen() {
        
    var element = document.getElementById("loadingScreen");
    var spinner = document.getElementById("spinner");
    var text = document.getElementById("load-text");
    var text2 = document.getElementById("search-text");


    element.classList.add("loadingScreen", "highlight", "d-flex", "justify-content-center", "align-items-center", "vh-100");
    spinner.classList.add("spinner-border", "text-primary", "mt-3");
    text2.innerText = "Loading......";
    text.innerText = "Loading......";

  }


