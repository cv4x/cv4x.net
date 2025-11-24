((dynCore) => {
    dynCore.when(
        dynCore.require([
            'lib.bind',
            'lib.model',
            'app.globalModel',
            'lib.download',
            'app.emojify',
            'lib.hashWatch',
            'app.hashless'
        ]),
        dynCore.js('https://cdn.jsdelivr.net/npm/js-base64@3.7.5/base64.min.js'),
        dynCore.css('anime', 'app.anime')
    ).done((modules, bind, model, globalModel, download, emojify, hashWatch, hashless) => {
        dynCore.js('https://lib.claire-west.ca/vend/js/html2canvas.min.js');

        var maxYear = 2026;

        var emojiMap = {
            '🟠': {
                src: '/img/emoji/crunchyroll.png',
                alt: 'Crunchyroll'
            },
            '🟦': {
                src: '/img/emoji/hidive.png',
                alt: 'HIDIVE'
            },
            '💫': {
                src: '/img/emoji/disney+.png',
                alt: 'Disney+'
            },
            '📉': {
                src: '/img/emoji/netflix.png',
                alt: 'Netflix'
            },
            '💸': {
                src: '/img/emoji/prime.png',
                alt: 'Prime Video'
            },
            '🟥': {
                src: '/img/emoji/youtube.png',
                alt: 'YouTube'
            },
            '🤮': {
                src: '/img/emoji/hulu.png',
                alt: 'Hulu and/or HBO Max'
            },
            '🏊': {
                src: '/img/emoji/adultswim.svg',
                alt: 'Adult Swim'
            },
            '🇸': {
                src: '/img/emoji/samsungtv+.png',
                alt: 'Samsung TV Plus'
            },
            '🌊': {
                src: '/img/emoji/oceanveil.png',
                alt: 'OceanVeil'
            },
            '❓': {
                src: '/img/emoji/unknown.png'
            },
            '❌': {
                src: '/img/emoji/none.png'
            }
        };

        emojify.preload(Object.values(emojiMap).map(e => e.src));

        var convertTZ = function(time) {
            if (time[0] === '?') {
                return '????';
            }
            // parse hhmm as UTC+0
            // toTimeString uses browser time zone
            // return in hhmm format
            return new Date(Date.parse(new Date().toISOString().substr(0, 10) + 'T' + time.substr(0, 2) + ':' + time.substr(2, 2) + 'Z')).toTimeString().substr(0, 5).replace(':', '');
        };

        var convertScheduleTZs = function(schedule) {
            for (var day in schedule) {
                for (var i = 0; i < schedule[day].length; i++) {
                    var text = schedule[day][i];
                    // split into char array to account for multibyte emoji
                    if (!text) {
                        return '';
                    }
                    var chars = [...text];
                    var time = convertTZ(chars.slice(1, 5).join(''));
                    schedule[day][i] = chars[0] + time + chars.slice(5).join('');
                }
            }
        };

        var getCurrentSeason = function() {
            var seasons = [ "冬", "春", "夏", "秋" ];
            var month = new Date().getMonth();
            return seasons[Math.floor(month / 3)];
        };

        var years = {};
        var fetchYear = function(year) {
            if (!years[year]) {
                years[year] = $.Deferred();
                $.ajax('/json/anime/' + year + '.json?_=' + Date.now()).done(function(data) {
                    for (var season in data) {
                        if (data[season] && data[season].schedule) {
                            convertScheduleTZs(data[season].schedule);
                        }
                    }
                    years[year].resolve(data);
                });
            }
            return years[year];
        };

        var controller = {
            changeHash: function() {
                var hash = [...arguments].join('/');
                window.location.replace('#' + hash);
            },

            refresh: function() {
                if (!this.model.year) {
                    this.changeHash(globalModel.year);
                    return;
                }
                fetchYear(this.model.year).done((yearData) => {
                    if (this.model.yearData === yearData) {
                        return;
                    }
                    this.model.yearData = yearData;
                    // validate current season setting has data
                    if (!yearData[this.model.season]) {
                        var season = getCurrentSeason();
                        // if no data for current season, find a season with data
                        if (!yearData[season]) {
                            if (yearData.冬) {
                                season = '冬';
                            } else if (yearData.春) {
                                season = '春';
                            } else if (yearData.夏) {
                                season = '夏';
                            } else if (yearData.秋) {
                                season = '秋';
                            }
                        }
                        // season changed, update the hash and return to avoid refreshing twice
                        this.changeHash(this.model.year, season);
                        return;
                    }
                    this.refreshSeason();
                });
            },

            refreshSeason: function() {
                if (!this.model.year) {
                    return;
                }
                fetchYear(this.model.year).done((yearData) => {
                    var seasonData = yearData[this.model.season];
                    if (!seasonData || this.model.seasonData === seasonData) {
                        return;
                    }
                    if (this.model.season) {
                        // validate current tab setting has data
                        if (!seasonData[this.model.tab]) {
                            var tab = null;
                            if (seasonData.schedule) {
                                tab = 'schedule';
                            } else if (seasonData['wrap-up']) {
                                tab = 'wrap-up';
                            }
                            this.changeHash(this.model.year, this.model.season, tab);
                        }
                    }
                    this.model.seasonData = seasonData;
                    this.model._refresh();
                });
            },

            model: model({
                // default to current year, unless beyond the maximum allowed year
                year: globalModel.year <= maxYear ? globalModel.year : maxYear,

                isNotLastYear: function(year) {
                    return year < maxYear;
                },

                // change hash based on navigation controls
                prevYear: function(model) {
                    controller.changeHash(Number(model.year) - 1, '秋');
                },

                nextYear: function(model) {
                    controller.changeHash(Number(model.year) + 1, '冬');
                },

                setSeason: function(model) {
                    var $this = $(this);
                    if (!$this.hasClass('active')) {
                        controller.changeHash(model.year, $this.text());
                    }
                },

                setTab: function(model) {
                    controller.changeHash(model.year, model.season,
                        $(this).text().toLocaleLowerCase() || 'schedule');
                },

                hideUnmarked: localStorage.getItem('anime.hideUnmarked') === "true",
                toggleShowHide: function(model) {
                    model._set('hideUnmarked', !model.hideUnmarked);
                },

                marked: {},
                updateMarked: 0,
                toggleMarked: function(text, marked, model) {
                    if (model.hideUnmarked) {
                        return;
                    }
                    var title = text.substr(text.indexOf(' ') + 1);
                    if (marked.hasOwnProperty(title)) {
                        delete model.marked[title];
                    } else {
                        model.marked[title] = true;
                    }
                    localStorage.setItem('anime.markedItems', JSON.stringify(marked));
                    model._set('updateMarked', model.updateMarked + 1);
                },

                isMarked: function(updateMarked, prev, marked, text) {
                    if (!text) return false;
                    return marked[text.substr(text.indexOf(' ') + 1)] === true;
                },

                downloadSchedule: function(model) {
                    html2canvas($('#content-anime .weeklySchedule').get(0), {
                        useCORS: true,
                        scale: 3,
                        backgroundColor: $('body').hasClass('light') ? '#fff' : '#2f3136'
                    }).then(function(canvas) {
                        download(canvas.toDataURL(), model.year + ' (' + model.season + ').png');
                    });
                },

                malHref: function(mal) {
                    return 'https://myanimelist.net/anime/' + mal;
                },

                makeTierList: function() {
                    let allItems = [];
                    let schedule = controller.model._get('yearData.' + controller.model._get('season') + '.schedule');
                    for (let day in schedule) {
                        if (Array.isArray(schedule[day])) {
                            allItems.push(...schedule[day].map((title) => {
                                return title.substr(title.indexOf(' ') + 1);
                            }));
                        }
                    }

                    let marked = controller.model._get('marked');
                    let items = allItems.filter((title) => {
                        return marked[title];
                    });

                    hashless.navTo('/tierlist#' + Base64.encode(JSON.stringify(items)));
                },

                twemojify: globalModel.twemojify_custom, // function binding doesn't traverse models (yet)

                emojify: function(text) {
                    setTimeout(() => {
                        emojify(this.get(0), emojiMap, { title: true });
                    });
                    return text;
                }
            }, globalModel)
        };

        try {
            var markedItems = localStorage.getItem('anime.markedItems');
            if (markedItems) {
                controller.model.marked = JSON.parse(markedItems);
            }
        } catch (e) {
            controller.model.marked = {}
        }

        // when the model is updated (by hash changes), refresh the associated data
        controller.model._track('year', function() {
            controller.refresh();
        });
        controller.model._track('season', function() {
            controller.refreshSeason();
        });
        // keep localstorage in sync as the model is updated
        controller.model._track('hideUnmarked', function(hideUnmarked) {
            localStorage.setItem('anime.hideUnmarked', hideUnmarked);
        });

        // watch hash for changes - all layout for this page is dictated by this
        // it runs once when registering the handler to process the initial hash state
        hashWatch((args) => {
            return window.location.pathname.substr(1) === 'anime';
        }, (year, season, tab) => {
            season = decodeURIComponent(season);
            var hashChanged = false;
            if (year !== controller.model.year) {
                controller.model.year = year;
                hashChanged = true;
            }
            if (season !== controller.model.season) {
                controller.model.season = season;
                hashChanged = true;
            }
            if (tab !== controller.model.tab) {
                controller.model.tab = tab;
                hashChanged = true;
            }
            if (hashChanged) {
                controller.model.updateMarked++;
                controller.model._refresh();
            }
        });

        // do binding and declare app to dynCore
        var $page = $('#content-anime');
        return bind($page, controller.model).done(function() {
            controller.model._refresh();
            dynCore.declare('app.anime');
        });
    });
})(window.dynCore);
