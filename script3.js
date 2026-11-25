const $c = document.getElementById('c1');
const minDistance = 10;
const annotations = [];
const PEAK_DISTANCE = 25;
const ANNOTATION_INTERVAL = 3000; // milliseconds
const MAX_ANNOTATIONS = 12;
const ANNOTATION_TIMEOUT = 5000; // milliseconds before removal of call out


let g = $c.getContext('2d');
let lastAnnotationTime = 0;
let trendx = 0;
let trendy = 0;
let lastPeak = null;
var allitems = [];
	

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function item(slug, x, y, age) {
  	this.slug = slug;
  	this.x = x;
  	this.y = y;  // Remove the extra comma
  	this.age = age; // Age should be set to the passed value
}

function setup() {
  	g = $c.getContext('2d');
  	$c.width = innerWidth;
  	$c.height = innerHeight;
}



function drawAnnotations() {

    g.strokeStyle = "#ff3030";
    g.fillStyle = "#000000";
    g.lineWidth = 2;
    g.font = "bold 12px Verdana";

    for (const a of annotations) {

        const left = (a.x < 0);

        const x1 = a.x;
        const y1 = a.y;

        const x2 = left ? x1 - 40 : x1 + 40;

        // Northern peaks lead upwards; southern peaks lead downwards.
        const south = y1 > 0;
        const y2 = south ? y1 + 40 : y1 - 40;

        const x3 = left ? x2 - 140 : x2 + 140;

        // Red circle
        g.beginPath();
        g.arc(x1, y1, 8, 0, Math.PI * 2);
        g.stroke();

        // Diagonal leader
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();

        // Horizontal leader
        g.beginPath();
        g.moveTo(x2, y2);
        g.lineTo(x3, y2);
        g.stroke();

        // Headline text
        g.save();

        g.translate(x3, south ? y2 + 20 : y2 - 30);
      
        g.scale(1.4, 1);

        g.textAlign = left ? "right" : "left";

        const maxWidth = 200;
        const words = a.headline.split(/\s+/);

        let line1 = a.headline;
        let line2 = "";

        // Only split if the headline is too wide.
        if (g.measureText(line1).width > maxWidth && words.length > 1) {

            let bestSplit = 1;
            let bestDifference = Infinity;

            // Find the most balanced split where both lines fit.
            for (let i = 1; i < words.length; i++) {

                const first = words.slice(0, i).join(" ");
                const second = words.slice(i).join(" ");

                const width1 = g.measureText(first).width;
                const width2 = g.measureText(second).width;

                if (width1 <= maxWidth && width2 <= maxWidth) {

                    const difference = Math.abs(width1 - width2);

                    if (difference < bestDifference) {
                        bestDifference = difference;
                        bestSplit = i;
                    }
                }
            }

            // Fallback if neither line can fit within maxWidth.
            if (bestDifference === Infinity) {

                for (let i = 1; i < words.length; i++) {

                    const first = words.slice(0, i).join(" ");
                    const second = words.slice(i).join(" ");

                    const difference = Math.abs(
                        g.measureText(first).width -
                        g.measureText(second).width
                    );

                    if (difference < bestDifference) {
                        bestDifference = difference;
                        bestSplit = i;
                    }
                }
            }

            line1 = words.slice(0, bestSplit).join(" ");
            line2 = words.slice(bestSplit).join(" ");
        }

        // Draw first line
        g.fillText(line1, 0, 0);

        // Draw second line if required
        if (line2) {
             g.fillText(line2, 0, 22);
        }      

        g.restore();
    }
}







function drawFeedTitle() {
    if (typeof window.getFeedTitleOverlay !== "function") return;

    const overlay = window.getFeedTitleOverlay();
    if (!overlay || !overlay.title || Date.now() > overlay.until) return;

    g.save();

    const maxWidth = Math.min($c.width * 0.78, 620);
    let fontSize = 22;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold " + fontSize + "px Arial";

    while (fontSize > 14 && g.measureText(overlay.title).width > maxWidth) {
        fontSize--;
        g.font = "bold " + fontSize + "px Arial";
    }

    const textWidth = Math.min(g.measureText(overlay.title).width + 30, maxWidth + 30);
    g.fillStyle = "rgba(0, 0, 0, 0.58)";
    g.fillRect(-textWidth / 2, -22, textWidth, 44);

    g.fillStyle = "#d7ffd7";
    g.shadowColor = "#00e700";
    g.shadowBlur = 14;
    g.fillText(overlay.title, 0, 0, maxWidth);

    g.restore();
}


function render() {
  	const { width, height } = $c;
  	g.clearRect(0, 0, width, height);
  	const t = new Date().getTime() * 5.0e-4;

  	g.save();
  	g.translate(0.5, 0.5);
  	g.translate(width / 2, height / 2);

  	// Create an object to store the highest point for each mountain
  	let highestPeak = {
    	radius: -Infinity,
    	x: 0,
    	y: 0
  	};

  	for (let i = 0; i < 4000; i++) {
    	const coeftt = Math.abs(noise.perlin2(i, t * 0.05));
    	const theta = (i * 2 + t * 1e-2 + 1 * noise.perlin2(t * 1e-1, i)) % (2 * Math.PI);
    	const cm = Math.abs(noise.perlin2(theta * 3, t * 1e-1 + i * 0.0005) + 1) * 0.5;
    	const mountains = 300.0 * Math.pow(cm, 8.0);
    	const dy = 15.0 * noise.perlin2(theta + coeftt * 5.0 + 20 * noise.perlin2(theta, 10 * i), t * 0.05);
    	const y = 200.0 + dy + mountains;

    	const gray = (1.0 - Math.pow(((1.0 - coeftt) * 100 + 2 * mountains) / 255, 2.0)) * 50;
    	g.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;

    	const px = Math.cos(theta) * y;
    	const py = Math.sin(theta) * y;

 			g.fillRect(px, py, 1, 1);

			if (y > highestPeak.radius) {
    			highestPeak.radius = y;
	    		highestPeak.x = px;
	    		highestPeak.y = py;
			}
  		}

  		const now = performance.now();

        // Keep an existing callout at its original coordinates while its
        // corresponding peak remains nearby. Only refresh its expiry timer.
        const existing = annotations.find(a => distance(a, highestPeak) < 80);

        if (existing) {
            existing.lastSeen = now;
        } else if (
            (lastPeak === null || distance(highestPeak, lastPeak) > PEAK_DISTANCE) &&
            (now - lastAnnotationTime > ANNOTATION_INTERVAL)
        ) {





            const headline = (typeof window.getNextHeadline === "function")
                ? window.getNextHeadline()
                : null;

            if (headline) {

                annotations.push({
                    x: highestPeak.x,
                    y: highestPeak.y,
                    headline: headline,
                    lastSeen: now
                });

                if (annotations.length > MAX_ANNOTATIONS) {
                    annotations.shift();
                }

                lastPeak = { x: highestPeak.x, y: highestPeak.y };
                lastAnnotationTime = now;
            }
        }

        // Remove callouts only after they have stopped matching a visible peak.
        for (let i = annotations.length - 1; i >= 0; i--) {
            if (now - annotations[i].lastSeen > ANNOTATION_TIMEOUT) {
                annotations.splice(i, 1);
            }
        }

	drawAnnotations();
    drawFeedTitle();

  	g.restore();
  	requestAnimationFrame(render);
}


window.addEventListener('resize', (e) => {
	setup();
});

setup();
render();

