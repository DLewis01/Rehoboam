
/* CONFIG HERE */
var chars = ["0", "1"];
var fontsize = 20;
var displayTime = 1000 * 10;
var typeDelay = 0;
/* END OF CONFIG */

function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
}

(function() {
		var lastTime = 0;
		var vendors = ['ms', 'moz', 'webkit', 'o'];
		for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
				window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
				window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
		}

		if (!window.requestAnimationFrame)
				window.requestAnimationFrame = function(callback, element) {
						var currTime = new Date().getTime();
						var timeToCall = Math.max(0, 16 - (currTime - lastTime));
						var id = window.setTimeout(function() {
										callback(currTime + timeToCall);
								},
								timeToCall);
						lastTime = currTime + timeToCall;
						return id;
				};

		if (!window.cancelAnimationFrame)
				window.cancelAnimationFrame = function(id) {
						clearTimeout(id);
				};
}());

var c, c2, cwidth, cheight, ctx, ctx2;
var yPositions = new Array(300).join(0).split('');

function draw() {
		ctx.shadowColor = "rgba(0,0,0,0)";
		ctx.fillStyle = 'rgba(0,0,0,.05)';
		ctx.fillRect(0, 0, cwidth, cheight);

		/*
		    ctx2.clearRect(0,0,c2.width,c2.height);
		    ctx2.drawImage(c, 0,0);
		    ctx.clearRect(0,0,c.width,c.height);
		    ctx.globalAlpha = 0.95;
		    ctx.drawImage(c2,0,0);
		*/

		ctx.fillStyle = '#d3ffd3';
		ctx.shadowColor = "#d3ffd3";
		if ($('body').hasClass('loaded')) {
				ctx.fillStyle = '#00e700';
				ctx.shadowColor = "#00e700";
		}

		if ($('body').hasClass('failure')) {
				ctx.fillStyle = '#e70000';
				ctx.shadowColor = "#e70000";
		}
		ctx.font = '20pt Source Code Pro';
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.shadowBlur = 10;

	

	yPositions.map(function(y, index) {
				var text = chars[getRandomInt(0, chars.length - 1)];
				var x = (index * fontsize) + fontsize;
				c.getContext('2d').fillText(text, x, y);
				if (y > 100 + Math.random() * 1e4) {
						yPositions[index] = 0;
				} else {
						yPositions[index] = y + fontsize;
				}
		});

}

var titles = [];                         // Headlines waiting for the scrolling ticker
var annotationTitles = [];                // Separate queue for mountain annotations
var seenNewsItems = new Set();
var seenNewsTitles = new Set();
var nextFeedFetch = 0;
var FEED_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
var RSS_URL = "https://rss.dw.com/xml/rss-en-all";
//var RSS_URL = "https://www.abc.net.au/news/feed/45910/rss.xml";
var errorthrown = false;
var fetchrunning = false;
window.rehoboamNewsStatus = function() {
    return {
        feed: RSS_URL,
        fetching: fetchrunning,
        tickerQueued: titles.length,
        annotationQueued: annotationTitles.length,
        nextFetch: new Date(nextFeedFetch).toLocaleTimeString()
    };
};

// script3.js calls this when it creates a new mountain annotation.
// Keep this queue separate so the ticker cannot consume annotation headlines.

window.getNextHeadline = function() {
    return annotationTitles.length ? annotationTitles.shift() : null;
};

var cTitle = "";
var lastType;
var lastNews = 0;
var msgBox;


function renderText() {
	if (Date.now() - lastType < typeDelay) {
		return;
	}
	lastType = new Date();
	if (cTitle.length === 0) { //either we're happily displaying or currently removing old news
		if (msgBox.html().length === 1) { //let's insert a new text!
			cTitle = titles.length ? titles[0] : "";
			if (cTitle.length === 0) {
				return; // Wait for the next RSS response
				}
			titles.splice(0, 1);
			lastNews = new Date();
		} else { //remove old text
			if (Date.now() - lastNews > displayTime) {
				var before = msgBox.html();
				msgBox.html(msgBox.html().substring(0, msgBox.html().length - 2) + '_');
				if (before === msgBox.html()) {
					msgBox.html(msgBox.html().substring(0, msgBox.html().length - 5));
					}
				}
			}
		} else { //seems we need to wait OR add to the title
			if (cTitle.length > 0) {
				msgBox.html(msgBox.html().substr(0, msgBox.html().length - 1) + cTitle[0] + '_');
				cTitle = cTitle.slice(1);
		}
	}
}


function getNewPosts() {
    var now = Date.now();

    // Only contact the feed at startup and then every 15 minutes.
    if (fetchrunning || now < nextFeedFetch) return;

    fetchrunning = true;
    nextFeedFetch = now + FEED_REFRESH_INTERVAL;

    console.log("Fetching DW RSS feed: " + RSS_URL);

    fetch(RSS_URL, { method: "GET", cache: "no-cache" })
        .then(function(response) {
            if (!response.ok) {
                throw new Error("RSS request failed: HTTP " + response.status);
            }
            return response.text();
        })
        .then(function(xmlText) {
            var xml = new DOMParser().parseFromString(
                xmlText,
                "application/xml"
            );

            if (xml.querySelector("parsererror")) {
                throw new Error("The RSS response was not valid XML");
            }

            var items = Array.from(xml.querySelectorAll("item"));

            if (!items.length) {
                throw new Error("The RSS feed contained no items");
            }

            // Process older headlines first.
            items.reverse().forEach(function(item) {

                // Only accept items categorised as "news".
                var categories = Array.from(
                    item.querySelectorAll("category")
                ).map(function(category) {
                    return category.textContent.trim().toLowerCase();
                });

                if (!categories.includes("news")) return;

                // Extract headline.
                var titleNode = item.querySelector("title");
                var title = titleNode
                    ? titleNode.textContent.trim()
                    : "";

                if (!title) return;

                // Create a normalised headline key.
                // This catches duplicates even if GUIDs differ.
                var titleKey = title
                    .toLowerCase()
                    .replace(/\s+/g, " ")
                    .trim();

                // Extract RSS item identifier.
                var idNode = item.querySelector("guid") ||
                             item.querySelector("link");

                var id = idNode
                    ? idNode.textContent.trim()
                    : titleKey;

                // Reject previously seen items or headlines.
                if (seenNewsItems.has(id) ||
                    seenNewsTitles.has(titleKey)) {
                    return;
                }

                // Remember both identifiers.
                seenNewsItems.add(id);
                seenNewsTitles.add(titleKey);

                // Add headline to ticker and annotation queues.
                titles.push(
                    title.replace(/&amp;/gi, "and") + "                "
                );

                annotationTitles.push(title);
            });

            // Keep the tracking sets bounded during long sessions.
            if (seenNewsItems.size > 1000) {
                seenNewsItems = new Set(
                    Array.from(seenNewsItems).slice(-500)
                );
            }

            if (seenNewsTitles.size > 1000) {
                seenNewsTitles = new Set(
                    Array.from(seenNewsTitles).slice(-500)
                );
            }

            console.log(
                "DW RSS: " + items.length + " feed items checked; " +
                titles.length + " ticker headlines queued; " +
                annotationTitles.length + " annotation headlines queued."
            );

            fetchrunning = false;
        })
        .catch(function(error) {
            console.error(
                "Unable to retrieve DW RSS headlines:",
                error
            );

            fetchrunning = false;

            // Retry after one minute if the feed is unavailable.
            nextFeedFetch = Date.now() + 60 * 1000;
        });
}


var fpslock = 30;
var lastloop = 0;
var isLoading = true;
var isActive = false;

function mainLoop() {
//	if (Date.now() - lastloop >= 30 / fpslock) {
//		lastloop = Date.now();
		draw();
		if (isActive === true) {
			if (errorthrown !== false) {
				$('.loading, .msgbox').removeClass('flex').css('display', 'none');
				$('.error').addClass('flex');
				$('body').addClass('failure');
			} else {
				if (fetchrunning === false && titles.length < 10) {
					getNewPosts();
					}
				if (isLoading === true) {
					if (fetchrunning === false) {
						isLoading = false;
						$('.loading').removeClass('flex').css('display', 'none');
						$('.msgbox').css('display', 'initial');
						$('body').addClass('loaded');
						}
					} else {
						renderText();
					}
				}
			}
//		}

		requestAnimationFrame(mainLoop);
}

$(document).ready(function() {
		c = $('#c').get(0);
		$('#c').css('height', $(window).height());
		$('#c').css('width', $(window).width());
		cwidth = c.width = $('body').width();
		cheight = c.height = $('body').height();
		ctx = c.getContext('2d');
		c2 = document.createElement('canvas');
		c2.width = c.width;
		c2.height = c.height;
		ctx2 = c2.getContext('2d');
		msgBox = $('.msgbox span');

		$('.loading').addClass('flex');
		mainLoop();
		setTimeout(function() {
				isActive = true;
		}, 0);
});

$('body').one('click', function() {
		errorthrown = true;
});

