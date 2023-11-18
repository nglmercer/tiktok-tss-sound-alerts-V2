// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let previousLikeCount = 0;

// These settings are defined by obs.html
if (!window.settings) window.settings = {};

$(document).ready(() => {
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function(e) {
        if (e.key === 'Enter') {
            connect();
        }
    });

    if (window.settings.username) {
        $('#connectButton').prop('disabled', true); // Desactivar el botón hasta que se establezca la conexión
        connect();
    }
});

function connect() {
    let uniqueId = window.settings.username || $('#uniqueIdInput').val();
    if (uniqueId !== '') {
        $('#stateText').text('Conectando...');
        $('#connectButton').prop('disabled', true);

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            $('#stateText').text(`Conectado a la sala ${state.roomId}`);

            // Habilitar el botón después de establecer la conexión
            $('#connectButton').prop('disabled', false);

        }).catch(errorMessage => {
            $('#stateText').text(errorMessage);

            // programar próximo intento si se establece el nombre de usuario obs
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }

            // Habilitar el botón en caso de error
            $('#connectButton').prop('disabled', false);
        });

    } else {
        alert('No se ingresó nombre de usuario');
    }
}

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    if (text) { // Verifica si la entrada no es undefined
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
        return ''; // Devuelve una cadena vacía si la entrada es undefined
    }
}

function updateRoomStats() {
    $('#roomStats').html(`Espectadores: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Diamantes: <b>${diamondsCount.toLocaleString()}</b>`)
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Agregar un nuevo mensaje al contenedor de chat
 */
function addChatItem(color, data, text, summarize) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    container.find('.temporary').remove();;

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    `);

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
    let filterWords = document.getElementById('filter-words').value.split(' ');
    // Convertir el texto a minúsculas para la comparación
    let lowerCaseText = text.toLowerCase();
    // Verificar si el texto contiene alguna de las palabras para filtrar
    for (let word of filterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            console.log('filtrado');
            return;
        }
    }
    cacheMessage(text);
    playSoundByText(text);
}


/**
 * Agregar un nuevo regalo al contenedor de regalos
 */
function addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;

    let html = `
      <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
          <img class="miniprofilepicture" src="${data.profilePictureUrl}">
          <span>
              <b>${generateUsernameLink(data)}:</b> <span><span style="color: ${data.giftName ? 'purple' : 'black'}">${data.giftName}</span></span></span><br>
              <div>
                  <table>
                      <tr>
                          <td><img class="gifticon" src="${data.giftPictureUrl}"></td>
                          <td>
                              <span><b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()} : ${(data.diamondCount * data.repeatCount).toLocaleString()} Diamantes </b><span><br>
                          </td>
                      </tr>
                  </tabl>
              </div>
          </span>
      </div>
  `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
    playSound(data.giftName);
    let giftContainer = document.getElementById('giftContainer');
    if (giftContainer) {
        let giftItem = document.createElement('div');
        giftItem.textContent = `Regalo: ${data.giftName}, Diamantes: ${data.diamondCount}`;
        giftContainer.appendChild(giftItem);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    let soundForm = document.getElementById('soundForm');
    let soundList = document.getElementById('soundList');

    if (!soundList) {
        console.error('No se encontró el elemento con id "soundList". Asegúrate de que exista en tu HTML.');
        return;
    }

    if (soundForm) {
        soundForm.addEventListener('submit', function(e) {
            e.preventDefault();

            let soundFiles = document.getElementById('soundFiles').files;

            for (let i = 0; i < soundFiles.length; i++) {
                let soundFile = soundFiles[i];

                let reader = new FileReader();
                reader.onloadend = function() {
                    let audioSrc = reader.result;
                    let giftName = soundFile.name.split('.').slice(0, -1).join('.'); // Use the file name as the gift name
                    localStorage.setItem(giftName, audioSrc);

                    addSoundToList(giftName, soundList);
                }
                reader.readAsDataURL(soundFile);
            }

            soundForm.reset(); // Clear the form after submitting
        });
    }

    // Load existing sounds
    for (let i = 0; i < localStorage.length; i++) {
        let giftName = localStorage.key(i);
        addSoundToList(giftName, soundList);
    }
});

function addSoundToList(giftName, soundList) {
    let listItem = document.createElement('li');
    listItem.textContent = giftName;

    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.className = 'deleteButton';
    deleteButton.addEventListener('click', function() {
        if (confirm('¿Estás seguro de que quieres eliminar este sonido?')) {
            localStorage.removeItem(giftName);
            soundList.removeChild(listItem);
        }
    });

    let renameButton = document.createElement('button');
    renameButton.textContent = 'Renombrar';
    renameButton.addEventListener('click', function() {
        let newName = prompt('Introduce el nuevo nombre para el sonido:', giftName);
        if (newName && newName !== giftName) {
            let audioSrc = localStorage.getItem(giftName);
            localStorage.removeItem(giftName);
            localStorage.setItem(newName, audioSrc);
            listItem.textContent = newName;
        }
    });
    listItem.prepend(renameButton);
    listItem.prepend(deleteButton); // Esto moverá el botón a la izquierda
    soundList.appendChild(listItem);
}


function playSound(giftName) {
    // Convertir el nombre del regalo a minúsculas
    let lowerCaseGiftName = giftName.toLowerCase();

    // Buscar en el almacenamiento local un sonido que contenga el nombre del regalo en su nombre
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);

        // Convertir la clave a minúsculas antes de hacer la comparación
        if (key.toLowerCase().includes(lowerCaseGiftName)) {
            let audioSrc = localStorage.getItem(key);

            // Agregar el audio a la cola de audioqueue
            audioqueue.enqueue(audioSrc);

            // Si el audio no está reproduciéndose, iniciar el reproductor
            if (!isPlaying) {
                kickstartPlayer();
            }
        }
    }
}
function playSoundByText(text) {
    // Convertir el texto a minúsculas
    let lowerCaseText = text.toLowerCase();

    // Verificar si el texto tiene una longitud mínima y máxima
    let minLength = 1; // Define tu longitud mínima aquí
    let maxLength = 20; // Define tu longitud máxima aquí
    if (lowerCaseText.length < minLength || lowerCaseText.length > maxLength) {
        return;
    }
    // Buscar en el almacenamiento local un sonido que contenga el texto en su nombre
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);

        // Convertir la clave a minúsculas antes de hacer la comparación
        if (key.toLowerCase().includes(lowerCaseText)) {
            let audioSrc = localStorage.getItem(key);

            console.log('audio al texto:', text);

            // Agregar el audio a la cola de audioqueue
            audioqueue.enqueue(audioSrc);

            // Si el audio no está reproduciéndose, iniciar el reproductor
            if (!isPlaying) {
                kickstartPlayer();
            }

            // Salir de la función después de encontrar el primer audio que coincide
            return;
        }
    }
}
function exportSettings() {
    // Convertir las configuraciones y sonidos a una cadena JSON
    let settings = JSON.stringify(localStorage);

    // Crear un elemento 'a' invisible
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(settings));
    element.setAttribute('download', 'settings.json');

    // Simular un click en el elemento 'a' para descargar el archivo
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function importSettings() {
    // Show the loading indicator
    document.getElementById('loadingIndicator').style.display = 'inline';

    // Read the file uploaded by the user
    let file = document.getElementById('importButton').files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            // Parse the file content to a JavaScript object
            let settings = JSON.parse(e.target.result);

            // Store the settings and sounds in localStorage
            for (let key in settings) {
                localStorage.setItem(key, settings[key]);
            }

            // Hide the loading indicator
            document.getElementById('loadingIndicator').style.display = 'none';
        };
        reader.readAsText(file);
    } else {
        // Hide the loading indicator
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}
// like stats
connection.on('like', (msg) => {
    if (typeof msg.totalLikeCount === 'number') {
        likeCount = msg.totalLikeCount;
        updateRoomStats();

        // Check if the like count has reached a multiple of 10, 100, 1000, etc.
        if (likeCount % 500 === 0 && likeCount !== previousLikeCount) {
            previousLikeCount = likeCount;
            const likeMessage = `${likeCount} likes.`;
            cacheMessage(likeMessage);
        }
    }
})

// Miembro se une
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#CDA434', msg, 'welcome', true);
    }, joinMsgDelay);
})
let processedMessages = {};
// New chat comment received
let lastComments = [];
let messageRepetitions = {};
let lastCommentTime = Date.now();
// Nuevo comentario de chat recibido
connection.on('chat', (msg) => {
    if (window.settings.showChats === "0") return;

    // Add the new comment to the list
    let now = Date.now();
    if (processedMessages[msg.comment] && now - processedMessages[msg.comment] < 30000) {
        // Si el mensaje ya ha sido procesado hace menos de
        return;
    }

    // Si el mensaje no ha sido procesado o fue procesado hace más de un minuto,
    // añadirlo a la estructura de datos con la hora actual
    processedMessages[msg.comment] = now;
    lastComments.push(msg.comment);

    // If the list has more than 20 elements, remove the oldest one
    if (lastComments.length > 20) {
        let removedComment = lastComments.shift();
        messageRepetitions[removedComment]--;
        if (messageRepetitions[removedComment] === 0) {
            delete messageRepetitions[removedComment];
        }
    }

    // Calculate the message rate
    let currentTime = Date.now();
    let messageRate = 1000 / (currentTime - lastCommentTime);
    lastCommentTime = currentTime;

    // Check the repetition count
    if (!messageRepetitions[msg.comment]) {
        messageRepetitions[msg.comment] = 0;
    }
    messageRepetitions[msg.comment]++;

    // If the message rate is high and the message has been repeated many times, filter it
    if (messageRate > 1 && messageRepetitions[msg.comment] > 5) {
        return;
    }

    addChatItem('', msg, msg.comment);
});

// Nuevo regalo recibido
connection.on('gift', (data) => {
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
})

// compartir, seguir
connection.on('social', (data) => {
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#CDA434' : '##CDA434';
    if (data.displayType.includes('follow')) {
        data.label = `${data.uniqueId} Te sigue`;
    }
    if (data.displayType.includes('shared')) {
        data.label = `${data.uniqueId} compartio el directo`;
    }

    addChatItem(color, data, data.label.replace('{0:user}', ''));
})

connection.on('streamEnd', () => {
    $('#stateText').text('Transmisión terminada.');

    // schedule next try if obs username set
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
})

var audio, chatbox, button, channelInput, audioqueue, isPlaying, add, client, skip;

const TTS_API_ENDPOINT = 'https://api.streamelements.com/kappa/v2/speech?'; // unprotected API - use with caution
const PRONOUN_API_ENDPOINT = 'https://pronouns.alejo.io/api/users/';
const maxMsgInChat = 2 * 10;
const DESCENDING = true; // newest on top
const VOICE_PREFIX = '&';
const pronoun_DB = {}; // username -> pronound_id
const FEM_PRONOUNS = ['sheher', 'shethey'];
var CHANNEL_BLACKLIST = [
    'streamlabs',
    'streamelements',
    'moobot',
    'nightbot',
    'ch4tsworld',
    'streamstickers',
    'laia_bot',
    'soundalerts',
    'ankhbot',
    'phantombot',
    'wizebot',
    'botisimo',
    'coebot',
    'deepbot',
];
var VOICE_LIST = {
    "Miguel (Spanish, American)": "Miguel",
    "Penélope (Spanish, American)": "Penelope",
    "Brian (English, British)": "Brian",
    "Amy (English, British)": "Amy",
    "Emma (English, British)": "Emma",
    "Geraint (English, Welsh)": "Geraint",
    "Russell (English, Australian)": "Russell",
    "Nicole (English, Australian)": "Nicole",
    "Joey (English, American)": "Joey",
    "Justin (English, American)": "Justin",
    "Matthew (English, American)": "Matthew",
    "Ivy (English, American)": "Ivy",
    "Joanna (English, American)": "Joanna",
    "Kendra (English, American)": "Kendra",
    "Kimberly (English, American)": "Kimberly",
    "Salli (English, American)": "Salli",
    "Raveena (English, Indian)": "Raveena",
    "Zhiyu (Chinese, Mandarin)": "Zhiyu",
    "Mads (Danish)": "Mads",
    "Naja (Danish)": "Naja",
    "Ruben (Dutch)": "Ruben",
    "Lotte (Polly) (Dutch)": "Lotte",
    "Mathieu (French)": "Mathieu",
    "Céline (French)": "Celine",
    "Chantal (French, Canadian)": "Chantal",
    "Hans (German)": "Hans",
    "Marlene (German)": "Marlene",
    "Vicki (German)": "Vicki",
    "Aditi (+English) (Hindi)": "Aditi",
    "Karl (Icelandic)": "Karl",
    "Dóra (Icelandic)": "Dora",
    "Carla (Italian)": "Carla",
    "Bianca (Italian)": "Bianca",
    "Giorgio (Italian)": "Giorgio",
    "Takumi (Japanese)": "Takumi",
    "Mizuki (Japanese)": "Mizuki",
    "Seoyeon (Korean)": "Seoyeon",
    "Liv (Norwegian)": "Liv",
    "Ewa (Polish)": "Ewa",
    "Maja (Polish)": "Maja",
    "Jacek (Polish)": "Jacek",
    "Jan (Polish)": "Jan",
    "Ricardo (Portuguese, Brazilian)": "Ricardo",
    "Vitória (Portuguese, Brazilian)": "Vitoria",
    "Cristiano (Portuguese, European)": "Cristiano",
    "Inês (Portuguese, European)": "Ines",
    "Carmen (Romanian)": "Carmen",
    "Maxim (Russian)": "Maxim",
    "Tatyana (Russian)": "Tatyana",
    "Enrique (Spanish, European)": "Enrique",
    "Conchita (Spanish, European)": "Conchita",
    "Mia (Spanish, Mexican)": "Mia",
    "Astrid (Swedish)": "Astrid",
    "Filiz (Turkish)": "Filiz",
    "Gwyneth (Welsh)": "Gwyneth",
    "Carter (English, American)": "en-US-Wavenet-A",
    "Paul (English, American)": "en-US-Wavenet-B",
    "Evelyn (English, American)": "en-US-Wavenet-C",
    "Liam (English, American)": "en-US-Wavenet-D",
    "Jasmine (English, American)": "en-US-Wavenet-E",
    "Madison (English, American)": "en-US-Wavenet-F",
    "Mark (English, American)": "en-US-Standard-B",
    "Vanessa (English, American)": "en-US-Standard-C",
    "Zachary (English, American)": "en-US-Standard-D",
    "Audrey (English, American)": "en-US-Standard-E",
    "Layla (English, British)": "en-GB-Standard-A",
    "Ali (English, British)": "en-GB-Standard-B",
    "Scarlett (English, British)": "en-GB-Standard-C",
    "Oliver (English, British)": "en-GB-Standard-D",
    "Bella (English, British)": "en-GB-Wavenet-A",
    "John (English, British)": "en-GB-Wavenet-B",
    "Victoria (English, British)": "en-GB-Wavenet-C",
    "Ron (English, British)": "en-GB-Wavenet-D",
    "Zoe (English, Australian)": "en-AU-Standard-A",
    "Luke (English, Australian)": "en-AU-Standard-B",
    "Samantha (English, Australian)": "en-AU-Wavenet-A",
    "Steve (English, Australian)": "en-AU-Wavenet-B",
    "Courtney (English, Australian)": "en-AU-Wavenet-C",
    "Jayden (English, Australian)": "en-AU-Wavenet-D",
    "Ashleigh (English, Australian)": "en-AU-Standard-C",
    "Daniel (English, Australian)": "en-AU-Standard-D",
    "Anushri (English, Indian)": "en-IN-Wavenet-A",
    "Sundar (English, Indian)": "en-IN-Wavenet-B",
    "Satya (English, Indian)": "en-IN-Wavenet-C",
    "Sonya (Afrikaans)": "af-ZA-Standard-A",
    "Aisha (Arabic)": "ar-XA-Wavenet-A",
    "Ahmad 1 (Arabic)": "ar-XA-Wavenet-B",
    "Ahmad 2 (Arabic)": "ar-XA-Wavenet-C",
    "Nikolina (Bulgarian)": "bg-bg-Standard-A",
    "Li Na (Chinese, Mandarin)": "cmn-CN-Wavenet-A",
    "Wang (Chinese, Mandarin)": "cmn-CN-Wavenet-B",
    "Bai (Chinese, Mandarin)": "cmn-CN-Wavenet-C",
    "Mingli (Chinese, Mandarin)": "cmn-CN-Wavenet-D",
    "Silvia (Czech)": "cs-CZ-Wavenet-A",
    "Marie (Danish)": "da-DK-Wavenet-A",
    "Annemieke (Dutch)": "nl-NL-Standard-A",
    "Eva (Dutch)": "nl-NL-Wavenet-A",
    "Lars (Dutch)": "nl-NL-Wavenet-B",
    "Marc (Dutch)": "nl-NL-Wavenet-C",
    "Verona (Dutch)": "nl-NL-Wavenet-D",
    "Lotte (Wavenet) (Dutch)": "nl-NL-Wavenet-E",
    "Tala (Filipino (Tagalog))": "fil-PH-Wavenet-A",
    "Marianne (Finnish)": "fi-FI-Wavenet-A",
    "Yvonne (French)": "fr-FR-Standard-C",
    "Gaspard (French)": "fr-FR-Standard-D",
    "Emilie (French)": "fr-FR-Wavenet-A",
    "Marcel (French)": "fr-FR-Wavenet-B",
    "Brigitte (French)": "fr-FR-Wavenet-C",
    "Simon (French)": "fr-FR-Wavenet-D",
    "Juliette (French, Canadian)": "fr-CA-Standard-A",
    "Felix (French, Canadian)": "fr-CA-Standard-B",
    "Camille (French, Canadian)": "fr-CA-Standard-C",
    "Jacques (French, Canadian)": "fr-CA-Standard-D",
    "Karolina (German)": "de-DE-Standard-A",
    "Albert (German)": "de-DE-Standard-B",
    "Angelika (German)": "de-DE-Wavenet-A",
    "Oskar (German)": "de-DE-Wavenet-B",
    "Nina (German)": "de-DE-Wavenet-C",
    "Sebastian (German)": "de-DE-Wavenet-D",
    "Thalia (Greek)": "el-GR-Wavenet-A",
    "Sneha (Hindi)": "hi-IN-Wavenet-A",
    "Arnav (Hindi)": "hi-IN-Wavenet-B",
    "Aadhav (Hindi)": "hi-IN-Wavenet-C",
    "Ishtevan (Hungarian)": "hu-HU-Wavenet-A",
    "Helga (Icelandic)": "is-is-Standard-A",
    "Anisa (Indonesian)": "id-ID-Wavenet-A",
    "Budi (Indonesian)": "id-ID-Wavenet-B",
    "Bayu (Indonesian)": "id-ID-Wavenet-C",
    "Gianna (Italian)": "it-IT-Standard-A",
    "Valentina (Italian)": "it-IT-Wavenet-A",
    "Stella (Italian)": "it-IT-Wavenet-B",
    "Alessandro (Italian)": "it-IT-Wavenet-C",
    "Luca (Italian)": "it-IT-Wavenet-D",
    "Koharu (Japanese)": "ja-JP-Standard-A",
    "Miho (Japanese)": "ja-JP-Wavenet-A",
    "Eiko (Japanese)": "ja-JP-Wavenet-B",
    "Haruto (Japanese)": "ja-JP-Wavenet-C",
    "Eichi (Japanese)": "ja-JP-Wavenet-D",
    "Heosu (Korean)": "ko-KR-Standard-A",
    "Grace (Korean)": "ko-KR-Wavenet-A",
    "Juris (Latvian)": "lv-lv-Standard-A",
    "Nora (Norwegian, Bokmål)": "nb-no-Wavenet-E",
    "Malena (Norwegian, Bokmål)": "nb-no-Wavenet-A",
    "Jacob (Norwegian, Bokmål)": "nb-no-Wavenet-B",
    "Thea (Norwegian, Bokmål)": "nb-no-Wavenet-C",
    "Aksel (Norwegian, Bokmål)": "nb-no-Wavenet-D",
    "Amelia (Polish)": "pl-PL-Wavenet-A",
    "Stanislaw (Polish)": "pl-PL-Wavenet-B",
    "Tomasz (Polish)": "pl-PL-Wavenet-C",
    "Klaudia (Polish)": "pl-PL-Wavenet-D",
    "Beatriz (Portuguese, Portugal)": "pt-PT-Wavenet-A",
    "Francisco (Portuguese, Portugal)": "pt-PT-Wavenet-B",
    "Lucas (Portuguese, Portugal)": "pt-PT-Wavenet-C",
    "Carolina (Portuguese, Portugal)": "pt-PT-Wavenet-D",
    "Alice (Portuguese, Brazilian)": "pt-BR-Standard-A",
    "Маша (Masha) (Russian)": "ru-RU-Wavenet-A",
    "Илья (Ilya) (Russian)": "ru-RU-Wavenet-B",
    "Алёна (Alena) (Russian)": "ru-RU-Wavenet-C",
    "Пётр (Petr) (Russian)": "ru-RU-Wavenet-D",
    "Aleksandra (Serbian)": "sr-rs-Standard-A",
    "Eliska (Slovak)": "sk-SK-Wavenet-A",
    "Rosalinda (Spanish, Castilian)": "es-ES-Standard-A",
    "Elsa (Swedish)": "sv-SE-Standard-A",
    "Zehra (Turkish)": "tr-TR-Standard-A",
    "Yagmur (Turkish)": "tr-TR-Wavenet-A",
    "Mehmet (Turkish)": "tr-TR-Wavenet-B",
    "Miray (Turkish)": "tr-TR-Wavenet-C",
    "Elif (Turkish)": "tr-TR-Wavenet-D",
    "Enes (Turkish)": "tr-TR-Wavenet-E",
    "Vladislava (Ukrainian)": "uk-UA-Wavenet-A",
    "Linh (Vietnamese)": "vi-VN-Wavenet-A",
    "Nguyen (Vietnamese)": "vi-VN-Wavenet-B",
    "Phuong (Vietnamese)": "vi-VN-Wavenet-C",
    "Viet (Vietnamese)": "vi-VN-Wavenet-D",
    "Linda (English, Canadian)": "Linda",
    "Heather (English, Canadian)": "Heather",
    "Sean (English, Irish)": "Sean",
    "Hoda (Arabic, Egypt)": "Hoda",
    "Naayf (Arabic, Saudi Arabia)": "Naayf",
    "Ivan (Bulgarian)": "Ivan",
    "Herena (Catalan)": "Herena",
    "Tracy (Chinese, Cantonese, Traditional)": "Tracy",
    "Danny (Chinese, Cantonese, Traditional)": "Danny",
    "Huihui (Chinese, Mandarin, Simplified)": "Huihui",
    "Yaoyao (Chinese, Mandarin, Simplified)": "Yaoyao",
    "Kangkang (Chinese, Mandarin, Simplified)": "Kangkang",
    "HanHan (Chinese, Taiwanese, Traditional)": "HanHan",
    "Zhiwei (Chinese, Taiwanese, Traditional)": "Zhiwei",
    "Matej (Croatian)": "Matej",
    "Jakub (Czech)": "Jakub",
    "Guillaume (French, Switzerland)": "Guillaume",
    "Michael (German, Austria)": "Michael",
    "Karsten (German, Switzerland)": "Karsten",
    "Stefanos (Greek)": "Stefanos",
    "Szabolcs (Hungarian)": "Szabolcs",
    "Andika (Indonesian)": "Andika",
    "Heidi (Finnish)": "Heidi",
    "Kalpana (Hindi)": "Kalpana",
    "Hemant (Hindi)": "Hemant",
    "Rizwan (Malay)": "Rizwan",
    "Filip (Slovak)": "Filip",
    "Lado (Slovenian)": "Lado",
    "Valluvar (Tamil, India)": "Valluvar",
    "Pattara (Thai)": "Pattara",
    "An (Vietnamese)": "An",
};
const VOICE_LIST_ALT = Object.keys(VOICE_LIST).map(k => VOICE_LIST[k]);
const palabrasSpam = ['@'];
var voiceSelect = document.createElement('select');
Object.keys(VOICE_LIST).forEach(function(key) {
    var option = document.createElement('option');
    option.text = key;
    option.value = VOICE_LIST[key];
    voiceSelect.appendChild(option);
});

// Selecciona el div y agrega el select a este div
document.addEventListener('DOMContentLoaded', (event) => {
    var voiceSelectContainer = document.getElementById('voiceSelectContainer');
    voiceSelectContainer.appendChild(voiceSelect);
});

console.log('Voz seleccionada:', voiceSelect.value);
voiceSelect.addEventListener('change', function() {
    fetchAudio(voiceSelect.value);
});
let isReading = false;
let cache = [];
let lastText = "";

class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(element) {
        this.items.push(element);
    }

    dequeue() {
        if (this.isEmpty()) {
            return "Underflow";
        }
        return this.items.shift();
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

function cacheMessage(text) {
    // El resto de la función sigue igual
    if (text && text.length >= 3 && text.length <= 400 && text !== lastText) {
        cache.push(text);
        lastText = text;
        leerMensajes(); // Llama a leerMensajes() después de agregar un mensaje a la cola
    }
    if (cache.length > 15) {
        cache.shift();
    }

    // Resetear wordCounts
    wordCounts = {};
}
let wordCounts = {};

function filtros(text) {
    // Dividir el texto en palabras
    let words = text.split(' ');

    for (let word of words) {
        // Incrementar la cuenta de la palabra
        if (word in wordCounts) {
            wordCounts[word]++;
        } else {
            wordCounts[word] = 1;
        }

        // Si la palabra se ha visto más de 5 veces, no pasar el filtro
        if (wordCounts[word] > 5) {
            return false;
        }
    }

    // El resto de la función sigue igual
    if (cache.includes(text) || palabrasSpam.some(word => text.includes(word))) {
        return false;
    }
    cache.push(text);
    if (cache.length > 20) {
        cache.shift();
    }
    return true;
}

function leerMensajes() {
    if (cache.length > 0 && !isReading) {
        const text = cache.shift();
        fetchAudio(text);
    }
}

const readMessages = [];

async function fetchAudio(txt, voice) {
    try {
        const selectedVoice = selectVoice(language);
        const resp = await fetch(TTS_API_ENDPOINT + makeParameters({ voice: selectedVoice, text: txt }));
        if (resp.status !== 200) {
            console.error("Mensaje incorrecto");
            return;
        }

        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (audioqueue) {
            audioqueue.enqueue(blobUrl);
            if (!isPlaying) kickstartPlayer();
        }
        const index = cache.indexOf(txt);
        if (index !== -1) {
            cache.splice(index, 1);
        }

        // Elimina el mensaje de cache una vez que se ha reproducido
        const interval = setInterval(() => {
            if (audio.ended) {
                clearInterval(interval);
                URL.revokeObjectURL(blobUrl);
            }
        }, 200); // Verifica cada segundo si el audio ha terminado de reproducirse
        

    } catch (error) {
        console.error("Error:", error);
    }
}

function makeParameters(params) {
    return Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
}

function skipAudio() {
    if (audioqueue.isEmpty()) {
        isPlaying = false;
        audio.pause();
    } else {
        isPlaying = true;
        audio.src = audioqueue.dequeue();
        audio.load();
        audio.play();
    }
}

function kickstartPlayer() {
    if (audioqueue.isEmpty()) return isPlaying = false;
    if (!audio.paused) return console.error("started player while running");
    isPlaying = true;
    audio.src = audioqueue.dequeue();
    audio.load();
    audio.play().catch(() => {
        // Si ocurre un error al cargar el audio, intenta reproducir el siguiente audio
        kickstartPlayer();
    });
    audioqueue.dequeue();
    readMessages.shift();

    // Cuando ocurra un error al cargar el audio, intenta reproducir el siguiente audio
    audio.onerror = function() {
        kickstartPlayer();
    };
}
window.onload = async function() {
    try {
        audio = document.getElementById("audio");
        skip = document.getElementById("skip-button");
        isPlaying = false;
        audioqueue = new Queue();

        if (skip) {
            skip.onclick = skipAudio;
        } else {
            console.error("Error: skip-button is undefined");
        }

        if (audio) {
            audio.addEventListener("ended", kickstartPlayer);
        } else {
            console.error("Error: audio is undefined");
        }

        setInterval(leerMensajes, 1000); // Leer mensajes cada segundo

    } catch (error) {
        console.error("Error:", error);
    }
};