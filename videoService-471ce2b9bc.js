/**-----------------------------------------
 * description: videoService服务, 定义播放器相关的API
 * author: Pollux
 * create: 2015-12-15
 -----------------------------------------*/
;
(function() {

    // videojs绑定全局的配置项
    videojs.userConfig = {
        player: {
            stype: 'standard' // 默认为高清
        }
    };

    // videoService服务
    app.factory('videoService', ["uoocService", "$http", "$filter", function(uoocService, $http, $filter) {

        // 播放器添加中文语言配置
        videojs.addLanguage('zh', {
            "Play": "播放",
            "Pause": "暂停",
            "Current Time": "当前时间",
            "Duration Time": "总时长",
            "Remaining Time": "剩余时间",
            "Stream Type": "数据类型",
            "Silenciar": "静音",
            "LIVE": "直播",
            "Loaded": "加载完成",
            "Progress": "进度条",
            "Fullscreen": "全屏",
            "Non-Fullscreen": "退出全屏",
            "Mute": "Silenciar",
            "Unmuted": "No silenciado",
            "Playback Rate": "变速播放",
            "Subtitles": "副标题",
            "subtitles off": "关闭副标题",
            "Captions": "字幕",
            "captions off": "关闭字幕",
            "Chapters": "章节",
            "You aborted the video playback": "终止了视频回放",
            "A network error caused the video download to fail part-way.": "网络错误导致视频加载失败",
            "The video could not be loaded, either because the server or network failed or because the format is not supported.": "视频加载失败, 服务或网络网络链接失败或浏览器不支持",
            "The video playback was aborted due to a corruption problem or because the video used features your browser did not support.": "视频回放失败, 可能由于腐败问题或浏览器不支持",
            "No compatible source was found for this video.": "这个视频没有发现兼容的版本"
        });

        var UPLAYER = {};

        /**-----------------------------------------------------------
         * 内置方法
         -----------------------------------------------------------*/
        /**
         * [nocontextmenu 禁用指定元素的右键菜单]
         * @param  {[type]} ele [元素节点]
         */
        UPLAYER.nocontextmenu = function(ele) {

            if (window.Event && document.captureEvents) {
                document.captureEvents(Event.MOUSEUP);
            }

            function nocontextmenu() {
                event.cancelBubble = true;
                event.returnValue = false;
                return false;
            }

            function norightclick(e) {
                if (window.Event) {
                    if (e.which == 2 || e.which == 3) {
                        return false;
                    }
                } else if (event.button == 2 || event.button == 3) {
                    event.cancelBubble = true;
                    event.returnValue = false;
                    return false;
                }
            }

            ele.oncontextmenu = nocontextmenu; //对ie5.0以上
            ele.onmousedown = norightclick; //对其它浏览器
        };

        /**
         * [resize 重置视频大小]
         * @param  {[Object]} player [player实例]
         * @param  {[Number]} width  [需要设置的高, 默认为父元素宽]
         * @param  {[Number]} height [需要设置的宽, 默认为父元素高]
         * @return {[Object]}        [player实例]
         */
        UPLAYER.resize = function(player, width, height) {

            var playerEl = $(player.el_);
            // 计算宽高
            var curWidth = parseInt(width) || playerEl.width(), // 默认为父元素宽度
                curHeight = parseInt(height) || playerEl.height(); // 默认为父元素宽度

            // 设置宽高
            player.width(curWidth * 1);
            player.height(curHeight * 1);
            return player;
        };

        /**
         * palyer添加遮罩
         * 默认为添加, 存在remove则移除mask
         */
        UPLAYER.toggleMask = function(player, remove) {
            var playerEl = $(player.el_);
            if (remove) { // 删除
                playerEl.find('.vjs-mask').remove();
            } else { // 新增
                playerEl.append('<div class="vjs-mask"></div>');
                playerEl.find('.vjs-mask').click(function(e) {
                    e.stopPropagation();
                });
            }
            return player;
        };

        /**
         * [timeCallback 指定秒数执行回调]
         * @param  {[Object]}   player   [player实例]
         * @param  {[Number]}   time     [指定秒数]
         * @param  {Function}   callback [回调函数]
         * @return {[Object]}            [player实例]
         */
        UPLAYER.timeCallback = function(player, time, callback) {
            if (time < 0) return false;

            var _fn = function() {
                var cur = this.currentTime();
                if (parseInt(cur) == time) {
                    // 执行回调fncall
                    callback(this, time);

                    // 取消timeupdate监听
                    player.off('timeupdate', _fn);
                }
            };

            // 监听imeupdate
            player.on('timeupdate', _fn);
            return player;
        };

        /**
         * [timeCollectionCallback 给指定的时间点集合添加回调]
         * @param  {[Object]}   player    [player实例]
         * @param  {[Array]}    points    [description]
         * @param  {Function}   callback  [回调]
         * @return {[Object]}             [player实例]
         */
        UPLAYER.timeCollectionCallback = function(player, points, callback) {

            var isArray = angular.isArray(points);

            if (!isArray) {
                throw TypeError("points: 必须为数组");
                return player;
            }

            if (points.length <= 0) {
                return player;
            }


            for (var i = 0; i < points.length; i++) {
                UPLAYER.timeCallback(player, points[i], callback);
            }

            return player;
        };

        /**
         * [addProgressPoints 进度条添加节点以及点击的回调]
         * @param {[Object]}   player   [player实例]
         * @param {[Array]}    points   [时间点集合]
         * @return {[Object]}           [player实例]
         */
        UPLAYER.addProgressPoints = function(player, points, duration, callback) {

            var progressBar, // 进度条element
                i; // 当前时间的百分比

            // 如果未获取到总长度
            // 并且hasProgrssPoints
            if (!duration || player.hasProgrssPoints) {
                return;
            }

            seekBar = $(player.controlBar.progressControl.seekBar.el_);

            // 标识已添加
            player.hasProgrssPoints = true;
            for (i = 0; i < points.length; i++) {
                var pointProgress = (points[i] / duration) * 100;
                seekBar.append('<span class="vjs-seekbar-point" style="left: ' + pointProgress + '%"></span>')
            }

            // 给点集合添加回调
            UPLAYER.timeCollectionCallback(player, points, callback);
        };

        /**
         * [setBlurPause 浏览器失去焦点则暂停video播放]
         * @param  {[type]}   player [必须: videojs的player对象]
         * @return {[Object]} player [返回当前的player对象]
         */
        UPLAYER.setBlurPause = function(player) {
            $("html").on("mouseleave blur visibilitychange", function(event) {
                if (!player.destroyed && (event.target.webkitHidden || event.target.hidden || event.type == "mouseleave" || event.type == "blur")) {
                    return;
                }
            });
        };

        /**
         * [getCDNsource 根据cdn名称, 以及stype获取对应播放资源]
         * @param  {[String]} cndList   [cdn1, cdn2, cnd3]
         * @param  {[String]} stype [standard: '标清', high: '高清', super: '超清']
         * @return {[Object]}       [返回对应资源]
         */
        UPLAYER.getCDNsource = function(cndList, cndName, stype) {
            var playerConfig = videojs.userConfig.player;
            var finalSource = null, // 最终返回的source
                cndObj = null; // 当前选择的加速CDN

            stype = stype || 'standard';

            // 获取CDN
            for (var i = 0; i < cndList.length; i++) {
                if (cndList[i].cdn == cndName) {
                    cndObj = cndList[i];
                    break;
                }
            }

            cndObj = cndObj || cndList[0];

            // 获取匹配的资源
            for (var j = 0; j < cndObj.source.length; j++) {
                var source = cndObj.source[j];
                if (source.stype == stype) {
                    finalSource = source;
                    break;
                }
            };

            // 如果不存在则获取当前CDN下的最后一个
            if (!finalSource) {
                finalSource = cndObj.source[cndObj.source.length - 1]
            };
            return finalSource;
        };

        /**
         * [PARSE_SRT 字幕解析构造函数]
         * @param {[String]} SRTString [srt字幕字符串]
         * new UPLAYER.PARSE_SRT() 实例拥有2个方法:
         * getCaption(time) 获取指定毫秒数的caption
         * formateSRT(SRTString) 与构造函数参数 SRTString 一致, 用于解析srt字符串,
         * 构造函数传递参数后会自动执行formateSRT方法
         */
        UPLAYER.PARSE_SRT = function(SRTString, player) {

            // 添加tips
            UPLAYER.addTip(player, '字幕解析中...');

            var CAPTIONS_ORG_ARR = [], // 未分组的CAPTION数组
                CAPTIONS_FiNAL_OBJ = {}, // 按照 INTERVAL_TIME 毫秒分组完成CAPTION对象
                CAPTION_CURRENT_Ar, // 当前 CAPTION 数组
                CAPTION_CURRENT_key, // 当前 CAPTION key值

                INTERVAL_TIME = 20000;

            /**-------------------------------------------
             * 相关正则
             -------------------------------------------*/
            // 匹配得到SRTString时间段字符串 ( 00:00:01,501 --> 00:00:04,753 ↵-今天星期六天气不错 )
            var splitCaptionReg = /[\n\s]*((\d{1,2}):(\d{1,2}):(\d{1,2}).(\d{1,3}))\s*-->\s*((\d{1,2}):(\d{1,2}):(\d{1,2}).(\d{1,3}))[\n\s]+[\d\D]*?((?=\n+\d)|(?=\n*$))/g;
            splitCaptionReg.compile(splitCaptionReg);

            // var splitReg = /\s*[,.:，。：]\s*/img
            // splitReg.compile(splitReg);

            // 移除captionstring的时间(00:00:01,501 --> 00:00:04,753 ↵-今天星期六天气不错 ) => ( -今天星期六天气不错 )
            var delTimeReg = /([\n\s]*((\d{1,2}):(\d{1,2}):(\d{1,2}).(\d{1,3}))\s*-->\s*((\d{1,2}):(\d{1,2}):(\d{1,2}).(\d{1,3}))[\s\n]*)|(\s*\n*$)/g;
            delTimeReg.compile(delTimeReg)

            // 匹配获取时间 (00:00:01,501 --> 00:00:04,753 )
            var timeReg = /((\d{1,2}):(\d{1,2}):(\d{1,2}).(\d{1,3}))/g;
            timeReg.compile(timeReg);

            // 移除cption的样式
            // {\fnTahoma\fs14\bord1\3c&H400000&}
            // 
            // var kk = "{\bord1\3c&HFF8000&}-给我起来混蛋   -我不想惹麻烦别来管我{\r}{\fnTahoma\fs14\bord1\3c&H400000&}- Stand up, asshole. - I don't want any trouble. Leave me alone.{\r}"
            var delStyle = /(\{(.+)?\})+/g;
            delStyle.compile(delStyle);

            /**-------------------------------------------
             * 内置方法
             -------------------------------------------*/

            /**
             * [getTimeKey 根据毫秒数,以及 INTERVAL_TIME 时间间隔获取所属的key值]
             * @param  {[Number]} time          [当前时间]
             * @param  {[Number]} interval_time [时间间隔]
             * @return {[String]}               [返回key]
             */
            function getTimeKey(time) {
                return (Math.floor(time / INTERVAL_TIME) + 1) * INTERVAL_TIME + '';
            }

            /**
             * [getMiliSeconds 获取srt字幕的毫秒数]
             * @param  {[String]} str [srt字幕时间 00:00:04,879 ]
             * @return {[Number]}     [毫秒数]
             */
            function getMiliSeconds(timeString) {
                var a = timeString.split(','),
                    b = a[0].split(":");
                return b[0] * 3600 * 1000 + b[1] * 60 * 1000 + b[2] * 1000 + a[1] * 1;
            }

            /**
             * [getCaptionObj 获取当前时间段的字幕对象]
             * @param  {[String]} oneSRTString [一条字幕string]
             * @return {[Object]}              [返回对象, startTime, endTime, caption]
             */
            function getCaptionObj(oneSRTString) {

                // 获取当前SRTString的时间
                var timeAr = oneSRTString.match(timeReg);
                caption_ = (oneSRTString + '').replace(delTimeReg, "")

                // 返回SRTObject
                return {
                    startTime: getMiliSeconds(timeAr[0]), // 开始时间
                    endTime: getMiliSeconds(timeAr[1]), // 结束时间
                    caption: caption_.replace(delStyle, "") // 字幕
                }
            }

            var curCaption = null;
            
            // 循环数组获取当前的caption
            this.getResult = function(group, time){
                group = group || [];
                var result = '';
                for (i = 0; i < group.length; i++) {
                    var caption_ = group[i];
                    if (time <= caption_.endTime && time >= caption_.startTime) {
                        result = caption_.caption.replace('<br>', '');
                        this.lastGetCaptionObj = caption_; // 设置上一个caption
                        return result;
                    }
                };
                return result;
            }

            /**
             * [getCaption 根据毫秒数获取当前的caption]
             * @param  {[Number]} time [毫秒数]
             * @return {[Stirng]}      [返回caption标题]
             */
            this.getCaption = function(time) {

                var key = getTimeKey(time),
                    result, // 返回的字幕
                    i;
                
                /**
                 * 如果当前时间在上次获取caption对象之间则直接返回上次caption
                 */
                if(this.lastGetCaptionObj && time <= this.lastGetCaptionObj.endTime && time >= this.lastGetCaptionObj.startTime){
                    return this.lastGetCaptionObj.caption;
                }
                /**
                 * 如果不存在 CAPTION_CURRENT_Ar, 或 CAPTION_CURRENT_key 不等于当前key
                 * 则获取新的 CAPTION_CURRENT_Ar, 否则维持不变
                 */
                if (!CAPTION_CURRENT_Ar || CAPTION_CURRENT_key != key) {
                    CAPTION_CURRENT_Ar = CAPTIONS_FiNAL_OBJ[key]; // 当前CAPTION对象
                    CAPTION_CURRENT_key = key; // 当前CAPTION对象
                };

                // 不存在 CAPTION_CURRENT_Ar
                if (!CAPTION_CURRENT_Ar) {
                    return "";
                }

                result = this.getResult(CAPTION_CURRENT_Ar, time);

                if(!result){
                    var lastGroup = CAPTIONS_FiNAL_OBJ[getTimeKey(time - INTERVAL_TIME)];
                    result = this.getResult(lastGroup, time);
                }else{
                    var nextGroup = CAPTIONS_FiNAL_OBJ[getTimeKey(time + INTERVAL_TIME - 1)];
                    result = this.getResult(lastGroup, time);
                }
                
                return result = "";
            };

            /**
             * [formateSRT 格式化SRT字符串]
             * @param  {[String]} SRTString [SRT字符串]
             * @return {[Array]}            [SRT数组]
             */
            this.formateSRT = function(SRTString, player) {
                var i, j;

                captionsAr = SRTString.match(splitCaptionReg);

                if (!captionsAr) {
                    // 添加tips
                    UPLAYER.addTip(player, '字幕解析失败');
                    return;
                }

                for (i = 0; i < captionsAr.length; i++) {
                    var curString = captionsAr[i],
                        curSRTSObj = getCaptionObj(curString);
                    CAPTIONS_ORG_ARR.push(curSRTSObj);
                };

                // 完成后给 CAPTIONS_ORG_ARR 分组, 按照每 INTERVAL_TIME 秒分组
                for (j = 0; j < CAPTIONS_ORG_ARR.length; j++) {
                    var captionObj_ = CAPTIONS_ORG_ARR[j],
                        skey = getTimeKey(CAPTIONS_ORG_ARR[j].startTime);
                    CAPTIONS_FiNAL_OBJ[skey] = CAPTIONS_FiNAL_OBJ[skey] || [];
                    CAPTIONS_FiNAL_OBJ[skey].push(captionObj_);
                };
                this.CAPTIONS_FiNAL_OBJ = CAPTIONS_FiNAL_OBJ;
                return CAPTIONS_FiNAL_OBJ;
            };

            // 存在参数则默认为SRTString 格式化string
            if (arguments.length > 0) {
                this.formateSRT(arguments[0], player);
            };
        };
        /**
         * 解析srt字幕
         */
        UPLAYER.getSrt = function(url, player) {
            
            return $.ajax({
                method: 'GET',
                url: $filter('escapeURL')(url),
                headers: {
                    //'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': "application/x-www-form-urlencoded;charset=utf-8",
                    'XSRF': $("meta[name=_xsrf]").attr("content")
                },
                dataType: 'text'
            }).error(function() {
                // 添加tips
                UPLAYER.addTip(player, '字幕加载失败');
            })
        };

        /**
         * @param  {Object} 指定节点
         * @param  {String} animateClass, 参数格式: classA,calssB, 参数格式2: classA
         * @param  {Number} interval 间隔时间, 默认3秒
         */
        UPLAYER.animate = function(ele, animateClass, interval) {
            var animates = animateClass.split(",");
            ele.show();
            ele.addClass(animates[0] + ' animated');

            setTimeout(function() {
                ele.removeClass(animates[0]);
                if (animates[1]) {
                    ele.addClass(animates[1]).one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
                        ele.removeClass(animates[1]);
                        ele.hide();
                    });
                } else {
                    ele.hide();
                }
            }, interval || 3000);
        };


        /**
         * 给视频添加提示信息
         * @param  {Object} player
         * @param  {String} tip
         * @param  {Number} 提示持续时间, 为0则不自动隐藏
         */
        UPLAYER.addTip = function(player, tip, interval) {
            var palerEl_ = $(player.el_),
                tipEl_ = palerEl_.find('.vjs-tip').remove();
            palerEl_.append('<div class="vjs-tip" style="display: none">' + tip + '</div>');

            // 添加动画
            UPLAYER.animate(palerEl_.find('.vjs-tip'), 'fadeInLeftBig,fadeOutLeftBig');
        };

        /**-----------------------------------------------------------
         * VIDEO组件
         -----------------------------------------------------------*/
        /**
         * [uoocComponent UOOC播放器通用配置组件]
         * @return {[type]} [videojs]
         */
        UPLAYER.uoocPlayerComponent = function() {
            var Component = videojs.getComponent('Component');
            var UoocPlayer = videojs.extend(Component, {
                constructor: function(player, options) {
                    Component.call(this, player, options);

                    // 公共配置项
                    var playerConfig = videojs.userConfig.player,
                        options_ = options || [],
                        playerEl = $(player.el_), // 播放器element
                        togglePlayBtn; // 播放按钮

                    playerEl.append('<div id="vjs-toggle-play-btn"></div>'); // 添加播放按钮
                    togglePlayBtn = playerEl.find('#vjs-toggle-play-btn');

                    // 禁用播放器的右键菜单
                    UPLAYER.nocontextmenu(player.el_);

                    // 浏览器失去焦点,停止播放
                    UPLAYER.setBlurPause(player);

                    togglePlayBtn.click(function() {
                        if (togglePlayBtn.hasClass('zoomIn')) {
                            player.play();
                        } else {
                            player.pause();
                        }
                    });

                    // 添加动画class
                    function toggleAnim(x) {
                        togglePlayBtn.show();
                        togglePlayBtn.removeClass().addClass(x + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
                            togglePlayBtn.removeClass();
                            togglePlayBtn.hide();
                        });
                    }

                    player.isPause = true;
                    // 播放
                    player.on('play', function() {

                        // 播放按钮播放动画
                        // toggleAnim('toggleFadeIn togglePause')
                    });

                    // 添加错误提示
                    player.on('error', function() {
                        var errorMsg = this.error_ ? this.error_.message : '视频加载失败',
                            errorDialog = playerEl.find('.vjs-modal-dialog-content');
                        errorDialog.html('<div class="vjs-model-wrongmsg">抱歉, &ensp;视频播放失败,&ensp;您可以尝试<span class="fu" onclick="location.reload();">刷新页面</span>操作 。<br> 如问题仍然未解决, 请<a class="fu" href="/index/service" target="_blank">反馈给我们</a>。<p class="emsg">' + errorMsg + '。</p></div>');
                    });

                    // 暂停
                    player.on('pause', function() {

                        // 播放按钮暂停
                        // toggleAnim('toggleFadeIn togglePlay')
                    });

                    // 双击进入全屏
                    playerEl.bind('dblclick', function(e) {
                        if (e.target.nodeName.toLowerCase() != 'video') {
                            return;
                        }
                        if (player.isFullscreen_) { // 退出全屏
                            player.exitFullscreen();
                        } else { // 进入全屏
                            player.requestFullscreen();
                        }
                        player.play();
                    });
                }
            });
            videojs.registerComponent('UoocPlayer', UoocPlayer);
            return videojs;
        };
        
        /**
         * 添加广告
         */
        UPLAYER.addPosterAdver = function(player, codeid) {
            
            // 公共配置项
            var playerConfig = videojs.userConfig.player;
            var palerBox = $(player.el_);
            var style = "position: absolute; top: 50%; left: 50%; z-index: 2; margin-left: -256px; margin-top: -160px; display: none; box-shadow: 0 0 20px 0 rgba(0,0,0,.2);";
            palerBox.find('.vjs-control-bar').after('<div class="vjs-poster-ad" style="'+ style +'"><div class="vjs-poster-inner"></div></div>');
            var contxt = palerBox.find('.vjs-poster-ad');
            var inner = contxt.find('.vjs-poster-inner');
            
            // 添加广告
            if(!codeid){ return; }
            uoocService.advert({
                code: codeid,
                target: inner,
                area: ['512px', '320px'],
                close: true,
                random: true,
                withBackground: true,
                onclose: function (){
                   player.play(); 
                   clearAd()
                   contxt.hide();
                }
            });
            
            var clearAd = function(){
                if(this.adtimer) clearTimeout(this.adtimer);
            };
            
            player.on('mousedown', function(){
                clearAd();
            });

            player.on('pause', function(){
                this.adtimer = setTimeout(function(){
                    var paused = player.paused();
                    if(paused){
                        contxt.show();
                        inner.show();
                    }
                }, 200);
            });

            player.on('mouseup', function(){
                clearAd();
                // this.adtimer = setTimeout(function(){
                //     var paused = player.paused();
                //     if(paused){
                //         contxt.show();
                //         inner.show();
                //     }
                // }, 200);
            });

            player.on('seeking', function(e) {
                clearAd();
                contxt.hide();
                inner.hide();
            });

            player.on('seeked', function(e) {
                clearAd();
                player.play();
            });
            
            player.on('play', function(e) {
                clearAd();
                contxt.hide();
                inner.hide();
            });
        };

        /**
         * 添加字幕
         */
        UPLAYER.addSubtitle = function(player, subtitleList, fsize) {

            subtitleList = subtitleList || [];

            if (!subtitleList.length || subtitleList.length <= 0) {
                return;
            }

            // 公共配置项
            var playerConfig = videojs.userConfig.player,
                options_ = subtitleList || [];
            subtitleList = angular.copy(subtitleList);
            //subtitleList.push({title: '隐藏字幕', uri: ''});

            var palerBox = $(player.el_);
            palerBox.find('.vjs-fullscreen-control').after('<div class="vjs-track"></div>');
            palerBox.append('<div class="vjs-caption"></div>');

            var contxt = palerBox.find('.vjs-track');

            contxt.append('<div class="vjs-track-list"><div class="vjs-track-txt">选择字幕</div><div style="display: none;" class="vjs-track-panle"></div>');
            var vjsTrackList = contxt.find('.vjs-track-list'),
                vjsTrackPanel = vjsTrackList.find('.vjs-track-panle'),
                gjsTrackTxt = contxt.find('.vjs-track-txt'),
                captionShow = palerBox.find('.vjs-caption');

            angular.forEach(subtitleList, function(trackSource) {
                vjsTrackPanel.append('<span class="vjs-track-item" title="' + trackSource.title + '" uri="' + trackSource.uri + '">' + trackSource.title + '</span>');
            });


            var taskItem = vjsTrackList.find('.vjs-track-item');
            vjsTrackList.hover(function() {
                vjsTrackPanel.show();
            }, function() {
                vjsTrackPanel.hide();
            });

            taskItem.click(function() {
                var ele = $(this),
                    uri = ele.attr('uri'),
                    title = ele.attr('title');

                player.trigger('trackChange', {
                    title: title,
                    uri: uri
                });
            });

            var curSource = {};
            curSubtitle = "";

            // 监听 trackChange
            player.on('trackChange', function(e, trackSource) {


                for (var i = 0; i < subtitleList.length; i++) {
                    if (subtitleList[i].title == trackSource.title) {
                        curSource = options_[i];
                        break;
                    }
                }


                if (!curSource) {
                    captionShow.hide();
                    return;
                }

                gjsTrackTxt.html(curSource.title);
                contxt.find('.vjs-track-item[title="' + curSource.title + '"]').addClass('active').siblings().removeClass('active');

                // 关闭字幕
                //if (trackSource.title == '隐藏字幕') {
                //    captionShow.hide();
                //    return;
                //}

                captionShow.show();
                if (!curSource.srt) {

                    // 添加tips
                    UPLAYER.addTip(player, '字幕: ' + curSource.title);

                    UPLAYER.getSrt(trackSource.uri, player).then(function(rdata) {
                        curSource.SRT = new UPLAYER.PARSE_SRT(rdata, player);
                    });
                }
            });

            var playerEle = $(player.el_);

            // 获取字幕
            player.on('timeupdate', function(e, trackSource) {
                if (curSource.SRT) {
                    var curtime = player.currentTime(), // 播放时间
                        pwidth = playerEle.width(), // 播放器大小
                        pgap = 100, // 字幕左右预留空间
                        subMaxLength = 0, // 每行文字数量
                        subLine = 1, // 字幕行数
                        fontSize = 0; // 文字大小

                    curSubtitle = curSource.SRT.getCaption(parseInt(curtime * 1000));
                    subLine = Math.ceil(curSubtitle.length / subMaxLength); // 字幕显示行数

                    // 计算文字大小
                    if (fsize && fsize > 0){
                        fontSize = fsize;
                    }else if(pwidth > 1600) {
                        fontSize = 40;
                    } else if (pwidth > 1000) {
                        fontSize = 24;
                    } else if (pwidth > 500) {
                        fontSize = 22;
                    } else {
                        fontSize = 18;
                    }

                    var validWidth = pwidth - pgap > 0 ? (pwidth - pgap) : pwidth;
                    subMaxLength = parseInt(validWidth / fontSize);

                    // 存在字幕
                    if (subLine > 0) {
                        // var re = new RegExp('(.{' + subMaxLength + '})', 'g'); // 根据每行文字长度添加分行br
                        // var stitle = curSubtitle.replace(re, '$1<br>'); // 添加换行符

                        // 设置字幕
                        captionShow.html(curSubtitle).css({ 'fontSize': fontSize + 'px' }).show();
                    } else {
                        captionShow.hide();
                    }
                }
            });

            if (subtitleList.length > 0) {
                player.trigger('trackChange', {
                    title: subtitleList[0].title,
                    uri: subtitleList[0].uri
                });
            }
        };

        /**
         * 根据权重获取线路
         */
        UPLAYER.getCndSource = function(cndList) {

            var cndList = cndList || [];

            var cndSource,
                sortArray = _.sortBy(cndList, 'weight'),
                sum = _.reduce(sortArray, function(memo, next) {
                    var nw = next.weight,
                        wkey = (memo + 1) + '-' + (next.weight + memo);
                    next['wkey'] = wkey; // 设置权重范围
                    return memo + nw;
                }, 0); // 权重总和
            randomNumber = _.random(1, sum); // 1 ~ sum(权重总和) 之间的随机数

            // 遍历获取范围
            for (var i = 0; i < sortArray.length; i++) {
                var citem = sortArray[i],
                    ar_ = citem['wkey'].split('-'),
                    sWeight = ar_[0],
                    eWeight = ar_[1];
                if (randomNumber >= sWeight && randomNumber <= eWeight) {
                    cndSource = citem;
                    break;

                }
            }
            return cndSource;
        };

        /**
         * [sourceComponent 根据cnd选择线路以及资源]
         * @return {[type]} [videojs]
         */
        UPLAYER.sourceComponent = function() {
            var Component = videojs.getComponent('Component');
            var VideoSource = videojs.extend(Component, {
                constructor: function(player, options) {
                    Component.call(this, player, options);

                    if (!options.length || options.length <= 0) {
                        return;
                    }

                    // 公共配置项
                    var playerConfig = videojs.userConfig.player;

                    options.currentTime = options.currentTime || 0;
                    // 创建UI
                    var contxt = $(this.el_); // outer
                    contxt.addClass('vjs-source-cdn');
                    contxt.append('<div class="vjs-source-cdn-head"></div><div class="vjs-source-cdn-bd"></div>');

                    var cdnHead = contxt.find('.vjs-source-cdn-head'); // cdn按钮组
                    var cdnBd = contxt.find('.vjs-source-cdn-bd'); // 资源组
                    cdnBd.append('<div class="vjs-source-txt"></div>');
                    var cdnTxt = cdnBd.find('.vjs-source-txt'); // 资源显示txt

                    angular.forEach(options, function(cndList, index) {
                        var cdn = cndList.cdn, // 当前选择加速, 记录方便下次进入时候自动选择该cdn
                            curBd = cdnBd.append('<div class="vjs-source-cdn-cont" cdn="' + cdn + '" style="display: none;"></div>'),
                            cont = curBd.find('.vjs-source-cdn-cont').eq(index),
                            pindex = index;

                        cdnHead.append('<span class="vjs-source-cdn-item " index="' + index + '" cdn="' + cdn + '">' + cndList.name + '</span>');
                        angular.forEach(cndList.source, function(source, index) {
                            cont.append('<span class="vjs-menu-content" uri="' + source.uri + '" ftype="' + source.ftype + '" name="' + source.name + '" stype="' + source.stype + '" cdn="' + cdn + '">' + source.name + '</span>')
                        });
                    });

                    var cndBtns = contxt.find('.vjs-source-cdn-item'); // CDN按钮
                    var sourcePanel = contxt.find('.vjs-source-cdn-cont'); // 资源panel

                    // 选择CDN
                    cndBtns.click(function() {
                        player.trigger('cdnChange', {
                            cdn: options[$(this).index()].cdn
                        });
                    });

                    // Hover显示对应资源列表
                    cdnBd.hover(function() {
                        // 显示对应的panel列表
                        var panel = contxt.find('.vjs-source-cdn-cont[cdn="' + playerConfig.cdn + '"]');
                        panel.show().siblings('.vjs-source-cdn-cont').hide();
                    }, function() {
                        cdnBd.find('.vjs-source-cdn-cont').hide();
                    });

                    // 点击对应资源
                    cdnBd.find('.vjs-menu-content').click(function() {
                        var ele = $(this),
                            cdn = ele.attr('cdn'),
                            stype = ele.attr('stype');
                        player.trigger('cdnChange', {
                            cdn: cdn,
                            stype: stype
                        });
                    });

                    // 当前已经播放的时间, 切换cnd则取当前时间
                    var videoCurrentTime = 0;

                    // 监听cdnChange
                    player.on('cdnChange', function(e, data) {
                        player.cdn = data.cdn;
                        angular.extend(playerConfig, data);

                        // 播放当前source
                        var source = UPLAYER.getCDNsource(options, data.cdn, data.stype);

                        // 不存在source
                        if (!source) {
                            player.src({ type: 'video/mp4', src: 'nosource' });
                            return;
                        }


                        var stypeBtn = cdnBd.find('.vjs-menu-content[cdn="' + source.cdn + '"][stype="' + source.stype + '"]'), // 当前选择的清晰度BTN
                            cdnBtn = $('.vjs-source-cdn-item[cdn="' + source.cdn + '"]'); // 选择线路BTN

                        // 设置选中样式
                        cdnBtn.addClass('active').siblings('span').removeClass('active');
                        stypeBtn.addClass('active').siblings('span').removeClass('active');

                        cdnTxt.html(source.name);

                        player.src({ type: source.ftype, src: source.uri });

                        // 添加tips
                        UPLAYER.addTip(player, '资源: ' + source.cdn + ' ' + source.name);

                        // 如果当前视频已经播放, 获取参数参入了currentTime,
                        // 则从指定位置开始播放
                        if (videoCurrentTime || options.currentTime) {
                            var time = videoCurrentTime > options.currentTime ? videoCurrentTime : options.currentTime;
                            setTimeout(function(){
                                player.currentTime(time);
                                player.play();
                            }, 400);
                        }
                    });

                    // 当视频进度变化记录播放进度
                    player.on(['timeupdate'], function() {
                        var ctime = player.currentTime();
                        videoCurrentTime = videoCurrentTime > ctime && ctime == 0 ? videoCurrentTime : ctime;
                    });

                    // player.on(['cdnChange'], function() {
                    //     videoCurrentTime = videoCurrentTime > 0 ? player.currentTime();
                    // });

                    // 默认播放第第一个资源
                    if (options.length > 0) {

                        var plyarSource = UPLAYER.getCndSource(options);
                        if (!plyarSource) {
                            firtSource = {
                                cdn: "cdn1",
                                ftype: "video/mp4",
                                name: "原画",
                                stype: "source",
                                uri: "nosource"
                            }
                        }

                        player.on('ready', function() {
                            var tsource_ = player.options_.controlBar.trackSource;
                            var track = angular.isArray(tsource_) ? tsource_ : tsource_[plyarSource.cdn];
                            UPLAYER.addSubtitle(player, track, options.playerOptions.fontsize);
                            player.trigger('cdnChange', {
                                cdn: plyarSource.cdn,
                                stype: plyarSource.stype
                            });
                        });
                    }

                }
            });
            videojs.registerComponent('VideoSource', VideoSource);
            return videojs;
        };

        // 注册默认组件
        UPLAYER.uoocPlayerComponent(); // UOOC播放器定制组件
        UPLAYER.sourceComponent(); // 资源组件
        return UPLAYER;
    }]);
})();
