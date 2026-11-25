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
            }, timeToCall);
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


// ---------------------------------------------------------------------------
// ABC NEWS FEED CYCLER
// ---------------------------------------------------------------------------

var ABC_FEEDS = [
    "https://www.abc.net.au/news/feed/10719986/rss.xml",
    "https://www.abc.net.au/news/feed/5512668/rss.xml",
    "https://www.abc.net.au/news/feed/5555988/rss.xml",
    "https://www.abc.net.au/news/feed/5555986/rss.xml",
    "https://www.abc.net.au/news/feed/5555990/rss.xml",
    "https://www.abc.net.au/news/feed/5633084/rss.xml",
    "https://www.abc.net.au/news/feed/5512674/rss.xml",
    "https://www.abc.net.au/news/feed/5470430/rss.xml",
    "https://www.abc.net.au/news/feed/5313390/rss.xml",
    "https://www.abc.net.au/news/feed/104217382/rss.xml",
    "https://www.abc.net.au/news/feed/104217374/rss.xml",
    "https://www.abc.net.au/news/feed/104217372/rss.xml",
    "https://www.abc.net.au/news/feed/10719976/rss.xml",
    "https://www.abc.net.au/news/feed/103728568/rss.xml",
    "https://www.abc.net.au/news/feed/103728564/rss.xml",
    "https://www.abc.net.au/news/feed/104333858/rss.xml",
    "https://www.abc.net.au/news/feed/103728570/rss.xml"
];

// Keep the proxy in one place. It returns the original RSS XML.
function getProxiedFeedURL(url) {
    return "https://proxy.cors.dev/" + url;
}

var currentFeedIndex = -1;
var currentFeedURL = "";
var currentFeedTitle = "";
var titles = [];
var annotationTitles = [];
var currentFeedAnnotationTitles = [];
var seenByFeed = new Map();

var fetchrunning = false;
var fetchToken = 0;
var activeController = null;
var emptyFeedTimer = null;
var FEED_TITLE_DISPLAY_MS = 5000;
var FEED_ERROR_ADVANCE_MS = 5000;

var errorthrown = false;
var isLoading = true;
var isActive = false;

var cTitle = "";
var tickerDisplay = "";
var lastNews = 0;
var msgBox;

var feedTitleOverlay = {
    title: "",
    until: 0
};

window.getFeedTitleOverlay = function() {
    return feedTitleOverlay;
};

window.rehoboamNewsStatus = function() {
    return {
        feed: currentFeedURL,
        feedTitle: currentFeedTitle,
        feedNumber: currentFeedIndex + 1,
        feedCount: ABC_FEEDS.length,
        fetching: fetchrunning,
        tickerQueued: titles.length,
        annotationQueued: annotationTitles.length
    };
};

// script3.js calls this when it creates a new mountain annotation.
// The annotation queue is independent of the scrolling ticker queue.
window.getNextHeadline = function() {
    if (annotationTitles.length === 0 && currentFeedAnnotationTitles.length) {
        annotationTitles = currentFeedAnnotationTitles.slice();
    }

    return annotationTitles.length ? annotationTitles.shift() : null;
};

function showFeedTitle(title) {
    currentFeedTitle = title || "ABC News";
    feedTitleOverlay = {
        title: currentFeedTitle,
        until: Date.now() + FEED_TITLE_DISPLAY_MS
    };
}

function clearTicker() {
    titles = [];
    annotationTitles = [];
    currentFeedAnnotationTitles = [];
    cTitle = "";
    tickerDisplay = "";

    if (msgBox && msgBox.length) {
        msgBox.text("");
    }
}

function getSeenSet(feedURL) {
    if (!seenByFeed.has(feedURL)) {
        seenByFeed.set(feedURL, {
            ids: new Set(),
            headlines: new Set()
        });
    }
    return seenByFeed.get(feedURL);
}

function advanceToNextFeed() {
    if (emptyFeedTimer) {
        clearTimeout(emptyFeedTimer);
        emptyFeedTimer = null;
    }

    var nextIndex = (currentFeedIndex + 1) % ABC_FEEDS.length;
    loadFeed(nextIndex);
}

function loadFeed(index) {
    if (emptyFeedTimer) {
        clearTimeout(emptyFeedTimer);
        emptyFeedTimer = null;
    }

    // Invalidate and abort any request still in progress.
    fetchToken++;
    var thisToken = fetchToken;

    if (activeController) {
        activeController.abort();
        activeController = null;
    }

    currentFeedIndex = index;
    currentFeedURL = ABC_FEEDS[currentFeedIndex];
    currentFeedTitle = "Loading ABC News";
    fetchrunning = true;
    clearTicker();

    console.log(
        "Loading ABC feed " + (currentFeedIndex + 1) + "/" +
        ABC_FEEDS.length + ": " + currentFeedURL
    );

    activeController = (typeof AbortController !== "undefined")
        ? new AbortController()
        : null;

    var options = {
        method: "GET",
        cache: "no-cache"
    };

    if (activeController) {
        options.signal = activeController.signal;
    }

    fetch(getProxiedFeedURL(currentFeedURL), options)
        .then(function(response) {
            if (!response.ok) {
                throw new Error("RSS request failed: HTTP " + response.status);
            }
            return response.text();
        })
        .then(function(xmlText) {
            if (thisToken !== fetchToken) return;

            var xml = new DOMParser().parseFromString(
                xmlText,
                "application/xml"
            );

            if (xml.querySelector("parsererror")) {
                throw new Error("The RSS response was not valid XML");
            }

            var channelTitleNode = xml.querySelector("channel > title");
            var channelTitle = channelTitleNode
                ? channelTitleNode.textContent.trim()
                : "ABC News";

            showFeedTitle(channelTitle);

            var items = Array.from(xml.querySelectorAll("item"));
            var seen = getSeenSet(currentFeedURL);
            var newHeadlines = [];

            // Oldest first, so the ticker reads the feed in chronological order.
            items.reverse().forEach(function(item) {
                var titleNode = item.querySelector("title");
                var title = titleNode ? titleNode.textContent.trim() : "";
                if (!title) return;

                var titleKey = title
                    .toLowerCase()
                    .replace(/\s+/g, " ")
                    .trim();

                var idNode = item.querySelector("guid") ||
                             item.querySelector("link");

                var id = idNode
                    ? idNode.textContent.trim()
                    : titleKey;

                if (seen.ids.has(id) || seen.headlines.has(titleKey)) {
                    return;
                }

                seen.ids.add(id);
                seen.headlines.add(titleKey);
                newHeadlines.push(title);
            });

            // Bound the duplicate trackers for long-running sessions.
            if (seen.ids.size > 1500) {
                seen.ids = new Set(Array.from(seen.ids).slice(-750));
            }
            if (seen.headlines.size > 1500) {
                seen.headlines = new Set(Array.from(seen.headlines).slice(-750));
            }

            titles = newHeadlines.map(function(title) {
                return title.replace(/&amp;/gi, "and") + "                ";
            });

            currentFeedAnnotationTitles = newHeadlines.slice();
            annotationTitles = currentFeedAnnotationTitles.slice();

            fetchrunning = false;
            activeController = null;

            console.log(
                "ABC RSS [" + channelTitle + "]: " +
                items.length + " items checked; " +
                newHeadlines.length + " new headlines."
            );

            // Empty feeds still get their five-second title card before advancing.
            if (newHeadlines.length === 0) {
                emptyFeedTimer = setTimeout(function() {
                    if (thisToken === fetchToken) {
                        advanceToNextFeed();
                    }
                }, FEED_TITLE_DISPLAY_MS);
            }
        })
        .catch(function(error) {
            if (thisToken !== fetchToken) return;
            if (error && error.name === "AbortError") return;

            console.error("Unable to retrieve ABC RSS feed:", error);

            fetchrunning = false;
            activeController = null;
            showFeedTitle("Feed unavailable");

            // Skip a failed feed after allowing its status title to be seen.
            emptyFeedTimer = setTimeout(function() {
                if (thisToken === fetchToken) {
                    advanceToNextFeed();
                }
            }, FEED_ERROR_ADVANCE_MS);
        });
}

// Space advances immediately to the next feed.
// Ignore key presses originating in editable controls.
window.addEventListener("keydown", function(event) {
    if (event.code !== "Space" || event.repeat) return;

    var target = event.target;
    var tag = target && target.tagName
        ? target.tagName.toLowerCase()
        : "";

    if (tag === "input" || tag === "textarea" || tag === "select" ||
        (target && target.isContentEditable)) {
        return;
    }

    event.preventDefault();
    advanceToNextFeed();
});

function renderText() {
    if (!msgBox || !msgBox.length || fetchrunning) return;

    var now = Date.now();

    // Type the current headline into the existing ticker.
    if (cTitle.length > 0) {
        tickerDisplay += cTitle.charAt(0);
        cTitle = cTitle.slice(1);
        msgBox.text(tickerDisplay + "_");

        if (cTitle.length === 0) {
            lastNews = now;
        }
        return;
    }

    // Hold the completed headline, then erase it.
    if (tickerDisplay.length > 0) {
        if (now - lastNews > displayTime) {
            tickerDisplay = tickerDisplay.slice(0, -2);
            msgBox.text(tickerDisplay + (tickerDisplay.length ? "_" : ""));

            if (tickerDisplay.length === 0) {
                msgBox.text("");
            }
        }
        return;
    }

    // Start the next headline in this feed.
    if (titles.length > 0) {
        cTitle = titles.shift();
        return;
    }

    // The current feed is finished: automatically load the next one.
    if (!emptyFeedTimer) {
        advanceToNextFeed();
    }
}

var fpslock = 30;
var lastloop = 0;

function mainLoop() {
    draw();

    if (isActive === true) {
        if (errorthrown !== false) {
            $('.loading, .msgbox').removeClass('flex').css('display', 'none');
            $('.error').addClass('flex');
            $('body').addClass('failure');
        } else {
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

    // Start with the first feed in the supplied list.
    loadFeed(0);

    setTimeout(function() {
        isActive = true;
    }, 0);
});

$('body').one('click', function() {
    errorthrown = true;
});
