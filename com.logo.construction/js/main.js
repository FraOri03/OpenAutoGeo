var csInterface = new CSInterface();

function setAIStatus(show) {
    var container = document.getElementById('stats-container');
    var statusText = document.getElementById('stats-text');
    if (show) {
        container.classList.remove('hidden');
        statusText.innerHTML = "Processing geometric shapes...";
    }
}

function showStats(totalX, drawnX, totalY, drawnY, totalPoints, circleCount) {
    var container = document.getElementById('stats-container');
    var text = document.getElementById('stats-text');
    
    var removed = (Number(totalX) + Number(totalY)) - (Number(drawnX) + Number(drawnY));
    
    container.classList.remove('hidden');
    text.innerHTML = `
        Analyzed <b>${totalPoints}</b> points.<br>
        Filtered out <b>${removed}</b> minor axes.<br>
        <span style="color:#ff4d4d;">Detected <b>${circleCount}</b> structural shapes.</span>
    `;
}

document.getElementById('btn-generate').addEventListener('click', function() {
    setAIStatus(true);
    
    setTimeout(function() {
        var lineSize = document.getElementById('lineSize').value;
        var isDashed = document.getElementById('isDashed').checked;
        var showCircles = document.getElementById('showCircles').checked;
        var showHandles = document.getElementById('showHandles').checked;
        var minScore = document.getElementById('minScore').value;

        // Comando con i parametri aggiornati
        var script = `runProceduralGrid(${lineSize}, ${isDashed}, ${showCircles}, ${showHandles}, ${minScore})`;
        
        csInterface.evalScript(script, function(result) {
            if (result.indexOf("Error") === 0) {
                alert(result);
                document.getElementById('stats-container').classList.add('hidden');
            } else if (result.indexOf("Success") === 0) {
                var p = result.split("|");
                // p =[Success, totalX, drawnX, totalY, drawnY, pts, circleCount]
                showStats(p[1], p[2], p[3], p[4], p[5], p[6]);
            }
        });
    }, 150); // Piccolo delay per far aggiornare l'UI
});

document.getElementById('btn-clear').addEventListener('click', function() {
    csInterface.evalScript('clearConstructionLayers()');
    document.getElementById('stats-container').classList.add('hidden');
});