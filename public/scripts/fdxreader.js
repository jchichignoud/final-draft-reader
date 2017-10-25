 /* global
    $, DOMParser, xml2json
*/

var xmlDoc = null;
var scriptJson = {};
var currentScene = null;
var currentSpeech = null;
var scenesList = [];
var characterClean = null;
var newClass = null;
var string = null;
var file = null;


///////////////////////////////////
////////HANDLE USER FILE///////////
///////////////////////////////////

// WHEN CHANGE IS DETECTED IN INPUT FIELD (file selected by user)
function onChange(event) {
    // select first element of user files (always returns an array)
    file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function (event) {
        var parser = new DOMParser();
        xmlDoc = parser.parseFromString(event.target.result, "text/xml");
        sendToParse();
        
    };
    addCoverPage(file);
    reader.readAsText(file);
    

}

// click on character name highlights all their dialogue
// $(document).on("click", '.character', function(event) { 
//     console.log(event.target.innerText);
//     $("div[data-speakingcharacter='" + event.target.innerText + "']").toggleClass("highlight");
// });


function sendToParse() {
    if (!xmlDoc) {
        window.alert("There's nothing loaded");
        return;
    }
    parseToJson(xmlDoc);
    if (!scriptJson.FinalDraft){
        alert("this is not a valid file");
        return;
    }
    //contains only the script elements, no extra stuff
    var scriptContent = scriptJson.FinalDraft[0].Content;
    parseToHTML(scriptContent);
}



// ON BUTTON CLICK, CHECK IF FILE IS LOADED + CHECK IF VALID
$("button").click(function () {
    if (!xmlDoc) {
        window.alert("There's nothing loaded");
        return;
    }
    parseToJson(xmlDoc);
    if (!scriptJson.FinalDraft){
        alert("this is not a valid file");
        return;
    }
    //contains only the script elements, no extra stuff
    var scriptContent = scriptJson.FinalDraft[0].Content;
    parseToHTML(scriptContent);
});


// parseToJson (called by button click)
function parseToJson(xml) {
        scriptJson = xml2json(xml); // send the responseXML of the request to xml2json script
        scriptJson = JSON.parse(scriptJson); // parse    
}

// parseToHTML (called on scriptContent by button click)
function parseToHTML(scriptArray){
    scriptArray.forEach(function (element, index, array){
        // console.log(element);
        if (element.ParagraphType === "Scene Heading") { // if current element is a heading
            if(currentScene){ // and if currentScene isn't empty
                addSceneToScript(currentScene); // add previous scene to the page   
            }
            currentScene = {};
            currentScene.text = "";
            currentScene.sceneNumber = element.ParagraphNumber;
            currentScene.sceneTitle = element.Paragraph.Text; // might want to split the INT/EXT and ToD out for extra metadata
            if (element.Paragraph.SceneProperties && ("Summary" in element.Paragraph.SceneProperties) && ("Paragraph" in element.Paragraph.SceneProperties.Summary) && ("Text" in element.Paragraph.SceneProperties.Summary.Paragraph)){
                // can break down above in several if statements to extra other info (scene number etc)
                currentScene.sceneSummary = element.Paragraph.SceneProperties.Summary.Paragraph.Text;
                // console.log(currentScene.sceneSummary);
            } else {
                currentScene.sceneSummary = "";
                // console.log("no scene summary");
            }
            
        } else if (element.ParagraphType === "Action"){
            if(currentScene){ // doesn't display anything that comes before the first scene heading, need fixing
                addActionToScene(element);
            } else {
                addElementToScript(element);
            }    
        } else if (element.ParagraphType === "Character"){
            currentSpeech = {};
            currentSpeech.text = "";
            characterClean = textWithoutDecoration(element.Paragraph);
            currentSpeech.speakingCharacter = characterClean.toUpperCase(); // will need to extract in-line parenthesis
            currentSpeech.extraInfo = ""; // will extract later
            currentSpeech.isClosed = false;
            currentSpeech.isDual = false; 
            // currentSpeech.text = "<h5 class='character'>" + characterClean + "</h5>"
            // if the next item is neither parenthesis nor dialogue, add the currentSpeech to the scene
        } else if (element.ParagraphType === "Dialogue" || element.ParagraphType === "Parenthetical"){
            // this catches user errors where they start dialogue without setting the character. uses previous speech character and adds it to the bubble
            if (!currentSpeech.isClosed) {
                addToSpeech(element);
            } else {
                currentSpeech.text = "";
                addToSpeech(element);
            }
            // console.log(element.ParagraphType);
            if (index === array.length - 1) { // if this is the end of the script
                addSpeechToScene(element);
            } else if (!(scriptArray[index + 1].ParagraphType === "Parenthetical") && !(scriptArray[index + 1].ParagraphType === "Dialogue")){
                // if the next item is neither Dialogue nor Parenthetical
                addSpeechToScene(element);
                currentSpeech.isClosed = true;
            }
        } else if (element.ParagraphType === "General" && element.Paragraph.DualDialogue){
            element.Paragraph.DualDialogue.forEach(function (element, index, array){
                if (element.ParagraphType === "Character"){
                    currentSpeech = {};
                    currentSpeech.text = "";
                    characterClean = textWithoutDecoration(element.Paragraph);
                    currentSpeech.speakingCharacter = characterClean; // will need to extract in-line parenthesis
                    currentSpeech.extraInfo = ""; // will extract later
                    currentSpeech.isClosed = false;
                    currentSpeech.isDual = true; 
                } else if (element.ParagraphType === "Dialogue" || element.ParagraphType === "Parenthetical"){
                    // this catches user errors where they start dialogue without setting the character. uses previous speech character and adds it to the bubble
                    if (!currentSpeech.isClosed) {
                        addToSpeech(element);
                    } else {
                        currentSpeech.text = "";
                        addToSpeech(element);
                    }
                    if (index === array.length - 1) { // if this is the end of the script
                        addSpeechToScene(element);
                    } else if (!(scriptArray[index + 1].ParagraphType === "Parenthetical") && !(scriptArray[index + 1].ParagraphType === "Dialogue")){
                        // if the next item is neither Dialogue nor Parenthetical
                        addSpeechToScene(element);
                        currentSpeech.isClosed = true;
                    }
                }
            }); 
        } else {
            //catch all for everything that's not one of the above
            if (currentScene){
                addActionToScene(element);
            } else {
                addElementToScript(element);
            }
        }
        if ((index === array.length - 1) && currentScene) {
            // console.log("this is the last item on the script: " + textWithoutDecoration(element.Paragraph.Text));
            addSceneToScript(currentScene);
            // once all is added to page, add classes for Material Design look
            materialDesign();
        }        
    });
}



///////////////////////////////////
////////ADDING TO HTML/////////////
///////////////////////////////////

function addCoverPage(coverObject){
    var mod = coverObject.lastModifiedDate;
    var monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    var modString = mod.getDate() + " " + monthArray[mod.getMonth()] + " " + mod.getFullYear();
    $('#cover').append("<div class='cover'><h5>" + coverObject.name.slice(0, -4) + "</h5><p>" + modString + "</p></div>");
}

function addSceneToScript(sceneObject){
    if(sceneObject.sceneNumber){
        $('#script').append("<div class='scene'><h3 class='sceneheading'>" + "<span class='scenenumber'>" + sceneObject.sceneNumber + "</span> " + sceneObject.sceneTitle + "</h3>" + sceneObject.text + "</div>");
    } else {
        $('#script').append("<div class='scene'><h3 class='sceneheading'>" + sceneObject.sceneTitle + "</h3>" + sceneObject.text + "</div>");
    }
    
    scenesList.push(currentScene);
    currentScene = null; // reset currentScene
}

function addElementToScript(elementObject){
    newClass = elementObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
    string = elementObject.Paragraph.Text; 
    if (string) {
        $('#script').append("<div class='" + newClass + "'><p>" + string + "</p></div>");
    }
}

function addActionToScene(actionObject){
    // set up class to be added to HTML, in lowercase without spaces
    newClass = actionObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
    string = textWithoutDecoration(actionObject.Paragraph);
    if (string) {
        currentScene.text += "<p class=" + newClass + ">" + string + "</p>";
    }
    // add the string in a new paragraph   
}

function addSpeechToScene(speechObject){
    if (currentSpeech.isDual){
        newClass = "dual speech";
    } else {
        newClass = "speech";
    }
    var speakingCharacter = currentSpeech.speakingCharacter;
    // console.log(currentSpeech)
    // add the string in a new paragraph? might want to differentiate between parenthetical and dialogue
    currentScene.text += "<div class='" + newClass + "' data-speakingcharacter='" + speakingCharacter + "''>" + "<h5 class='character'>" + speakingCharacter + "</h5>" + currentSpeech.text + "</div>";
    currentSpeech.isClosed = true;
}

function addToSpeech(dialogueObject){
    if(textWithoutDecoration(dialogueObject.Paragraph)){
        newClass = dialogueObject.ParagraphType.toLowerCase().replace(/\s+/g, '');
        string = textWithoutDecoration(dialogueObject.Paragraph);
        // add the string in a new paragraph? might want to differentiate between parenthetical and dialogue
        currentSpeech.text += "<p class=" + newClass + ">" + string + "</p>";
    }
}


// send in the element.Paragraph.Text to get a proper string
function textWithoutDecoration(stringOrArray) {
    var currentString = "";
    if (Array.isArray(stringOrArray)) {
        stringOrArray.forEach(function (subObject) {
            // set scriptString to the sum of all substrings
            //might want to read the extra info to italicize what needs to be
            currentString = currentString + subObject.Text;
        });
        // after all array elements added to the string, a
        return currentString;
    } else if (stringOrArray.Text) {
        // else if it's not an array, and there's text in it, just grab the text
        currentString = stringOrArray.Text;
        return currentString;
    }
}

// send in the element.Paragraph
function textWithDecoration(styledArray) {
    var text = "";
    styledArray.forEach(function (subObject) {
        var styledText = subObject.Text;
        if(subObject.TextStyle) {
            var styles = subObject.TextStyle.split("+");
            styles.forEach(function (style){
                if (style === "Bold") {
                    styledText = "<strong>" + styledText + "</strong>";       
                }
                if (style === "Underline") {
                    styledText = "<span class='underline'>" + styledText + "</span>";       
                }
                if (style === "Italic") {
                    styledText = "<em>" + styledText + "</em>";       
                } 
            });
        }
        text = text + styledText;     
    });
    return text;
}

function materialDesign() {
    $(".scene").addClass("card-panel");
    $(".speech").addClass("z-depth-2");
    $(".instruction").remove();
    $( ".sceneheading" ).click(function() {
      alert("you clicked a heading");
    });
}


//check for nested object without getting an undefined error if the middle levels don't exist
function get(obj, key) {
    return key.split(".").reduce(function(o, x) {
        return (typeof o == "undefined" || o === null) ? o : o[x];
    }, obj);
}
// usage: 
// get(object, 'loc.foo.bar') // will either return undefined or the value

  // Initialize collapse button
  $(".button-collapse").sideNav();
  // Initialize collapsible (uncomment the line below if you use the dropdown variation)
  //$('.collapsible').collapsible();
  
  var menu = document.querySelector('#cover');
var menuPosition = menu.getBoundingClientRect();
var placeholder = document.createElement('div');
placeholder.style.width = menuPosition.width + 'px';
placeholder.style.height = menuPosition.height + 'px';
var isAdded = false;

window.addEventListener('scroll', function() {
    if (window.pageYOffset >= menuPosition.top && !isAdded) {
        menu.classList.add('sticky');
        menu.parentNode.insertBefore(placeholder, menu);
        isAdded = true;
    } else if (window.pageYOffset < menuPosition.top && isAdded) {
        menu.classList.remove('sticky');
        menu.parentNode.removeChild(placeholder);
        isAdded = false;
    }
});