///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/_base/html',
  'dojo/topic',
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  "dojo/text!./templates/PageContainer.html",
  'jimu/dijit/ViewStack'
],
  function (declare,
    lang,
    array,
    html,
    topic,
    Evented,
    query,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    template,
    ViewStack) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,
      selected: '',
      tabs: null,
      average: false,
      nls: null,

      'baseClass': 'jimu-tab3',
      declaredClass: 'PageContainer', //TODO need to seperate from this

      //TODO need to update this to disable home when when currentIndex === altHomeIndex
      //TODO Previn asked about supporting a breadcrumb

      views: [],
      _currentIndex: -1,
      _homeIndex: 0,
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      altHomeIndex: 0,
      nextDisabled: false,
      _backLabels: [],

      //requires an instance of the appConfig
      //using altHomeIndex allows the user to set an alternate home view depending upon where we are in a workflow

      //views must implement a property called label that will uniquely identify the view
      //views can implement a deferred validate function that will be called prior to actually selecting the view
      //views can implement an altNextIndex or altBackIndex when a given view can navigate to one or more child views


      //public methods:
      //selectView
      //getSelectedIndex
      //getViewByIndex
      //getViewByTitle
      //addView
      //removeViewByTitle
      //removeView
      //removeViewByIndex

      //events:
      //view-changed
      //view-added
      //view-removed
      //theme-change
      //layout-change
      //style-change
      //widget-change
      //map-change

      //css classes:
      //control-node
      //control-table
      //container-node
      //tab-shelter
      //page-item-td-left
      //page-item-td-right
      //page-item-div
      //main-text
      //margin-right-5
      //margin-left-5
      //float-right
      //float-left
      //bg-back-img
      //bg-back-img-white
      //bg-home
      //bg-home-img
      //bg-home-img-white
      //bg-next-img
      //bg-next-img-white
      //bg-img


      //Use this when jimu dijit
      //postMixInProperties: function () {
      //  this.nls = window.jimuNls.pageContainer;
      //},
      //get nls from here for now
      constructor: function (options) {
        lang.mixin(this, options);

        //get the theme from appConfig so we can handle black/white image toggle
        this.theme = this.appConfig.theme.name;

        //subscribe to appConfigChange to know when to update local resources like images
        this.own(topic.subscribe("appConfigChanged", lang.hitch(this, this._onAppConfigChanged)));

        this.own(topic.subscribe("builder/styleChanged", lang.hitch(this, this._onBuilderStyleChanged)));
      },

      postCreate: function () {
        this.inherited(arguments);

        if (!this.displayControllerOnStart) {
          this.toggleController(true);
        }

        //use white images when in these themes...need a way to check if Dashboard is in light theme
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;

        this._initSelf();
        if (this.selected) {
          this.selectView(this.selected);
        } else if (this.views.length > 0) {
          this.selectView(this._homeIndex);
        }
        this._backLabels = [];
      },

      _onBuilderStyleChanged: function (styleChange) {
        this.setStyleColor(styleChange.styleColor);
      },

      _onAppConfigChanged: function (appConfig, reason, changedData) {
        switch (reason) {
          case 'themeChange':
            this.theme = appConfig.theme.name;
            this.updateImageNodes();
            this._updateViewTheme();
            this.emit('theme-change', appConfig, reason, changedData);
            break;
          case 'layoutChange':
            this.emit('layout-change', appConfig, reason, changedData);
            break;
          case 'styleChange':
            this.emit('style-change', appConfig, reason, changedData);
            break;
          case 'widgetChange':
            this.emit('widget-change', appConfig, reason, changedData);
            break;
          case 'mapChange':
            this.emit('map-change', appConfig, reason, changedData);
            break;
        }
      },

      selectView: function (index, fromNavCall) {
        //update _backLabels when selectView did not originate from navView where this is handled
        // slightly differently to account for back vs next calls
        if (!fromNavCall && index > 0) {
          var title = this.getSelectedTitle();
          var currentView = this.getViewByTitle(title);
          if (currentView && this._backLabels[this._backLabels.length - 1] !== currentView.label) {
            this._backLabels.push(currentView.label);
            this.backDisabled = false;
          }
        }

        this.viewStack.switchView(index);
        this._updateDomNodes(index);
        this._currentIndex = index;
        this.emit('view-changed', index);
      },

      showShelter: function () {
        html.setStyle(this.shelter, 'display', 'block');
      },

      hideShelter: function () {
        html.setStyle(this.shelter, 'display', 'none');
      },

      _initSelf: function () {
        if (!this.viewStack) {
          this.viewStack = new ViewStack(null, this.containerNode);
        } else {
          this.viewStack._currentView = undefined;
        }
        this._initViews();
      },

      _initViews: function () {
        array.forEach(this.views, lang.hitch(this, function (v) {
          this.addView(v);
        }));
      },

      _prevView: function () {
        this._navView('back-view');
      },

      _homeView: function () {
        this._navView('home-view');
      },

      _nextView: function () {
        this._navView('next-view');
      },

      _navView: function (navKey) {
        //when navigating backwards this function will first check for a stored label to navigate to
        //if a previous label is not stored this function will check the current view for an altBackIndex
        // if found it will navigate to that index otherwise it will decrement the index by one and navigate
        //altBackIndex allows the controller to navigate to the appropriate view when the appropriate "back" view
        // is not based simply on the previous view in the list but rather some setting the user has defined
        var title = this.getSelectedTitle();
        var currentView = this.getViewByTitle(title);

        var homeIndex = this._homeIndex;

        //check index stacks
        var navIndex;
        var deleteBackIndex = false;

        if (navKey === 'back-view') {
          if (this._backLabels.length > 0) {
            var backView;
            for (var _i = this._backLabels.length - 1; _i >= 0; _i--) {
              backView = this.getViewByTitle(this._backLabels[_i]);
              if (backView && this._backLabels[_i] !== title) {
                break;
              } else {
                this._backLabels.splice(_i, 1);
              }
            }
            navIndex = backView.index;
            deleteBackIndex = true;
          }
        }

        if (navKey === 'next-view' && typeof (currentView) === 'undefined') {
          if (this._backLabels.length > 0) {
            var _backTitle = this._backLabels[this._backLabels.length - 1];
            currentView = this.getViewByTitle(_backTitle);
          }
        }

        //check for defined alt indexes
        if (typeof (navIndex) === 'undefined') {
          navIndex = navKey === 'next-view' ? currentView.altNextIndex :
            navKey === 'back-view' ? currentView.altBackIndex : undefined;
        }

        var view;
        //if altIndex is defined default to it as long as it's not the home index
        // otherwise move in a forward or backward direction from the current index if it's not the home index'
        // home index should always pass through the validate function in case it needs to clear settings
        if (typeof (navIndex) !== 'undefined' && navKey !== 'home-view') {
          view = this.getViewByIndex(navIndex);
        } else {
          if (navKey === 'next-view') {
            if (this._currentIndex < this.viewCount - 1) {
              view = this.getViewByIndex(this._currentIndex + 1);
            }
          } else if (navKey === 'back-view') {
            if ((this._currentIndex - 1) <= this._homeIndex) {
              view = this.getViewByIndex(this._homeIndex);
            } else {
              view = this.getViewByIndex(this._currentIndex - 1);
            }
          } else {
            view = this.getViewByIndex(homeIndex);
          }
        }

        if (view) {
          var viewResults = { currentView: currentView, navView: view };
          this.emit(navKey, viewResults);

          //The optional validate function should return true or false if the navigation is supported
          // for example if navigating backwards will clear some state of a previous viewor set of views
          if (currentView.validate) {
            currentView.validate(navKey, viewResults).then(lang.hitch(this, function (v) {
              if (v) {
                this._navigate(view.index, deleteBackIndex, currentView.index, navKey, view.label);
              }
            }));
          } else {
            this._navigate(view.index, deleteBackIndex, currentView.index, navKey, view.label);
          }
        }
      },

      _navigate: function (idx, deleteBackIndex, currentViewIndex, navKey, viewLabel) {
        if (currentViewIndex > 0) {
          if (navKey === 'next-view') {
            if (this._backLabels[this._backLabels.length - 1] !== this.views[currentViewIndex].label) {
              this._backLabels.push(this.views[currentViewIndex].label);
              this.backDisabled = false;
            }
          }
        }

        if (deleteBackIndex) {
          for (var i = this._backLabels.length - 1; i >= 0; i--) {
            var bl = this._backLabels[i];
            if (bl === viewLabel) {
              this._backLabels.splice(i, 1);
              break;
            }
          }
          if (this._backLabels.length === 0) {
            this.backDisabled = true;
          }
        }

        this._currentIndex = idx;
        this.selectView(idx, true);
        this.emit('nav-view', idx);
      },

      getSelectedIndex: function () {
        return this._currentIndex;
      },

      getSelectedTitle: function () {
        return this.viewStack.getSelectedLabel();
      },

      getViewByIndex: function (idx) {
        if (this.views.length > idx) {
          return this.views[idx];
        }
      },

      getViewByTitle: function (title) {
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          if (view.label === title) {
            return view;
          }
        }
        return;
      },

      _updateControl: function (node, disable) {
        if (disable) {
          html.addClass(node, 'control-disbaled');
        } else {
          html.removeClass(node, 'control-disbaled');
        }
      },

      _updateViews: function () {
        //make sure the view index and count is current when add/remove view from stack
        this.viewCount = this.views.length;
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          view.setStyleColor(this.styleColor);
          if (typeof(view.index) !== 'undefined' && view.index !== i) {
            this.emit('view-index-change', {
              oldIndex: view.index,
              newIndex: i
            });
          }
          view.index = i;
        }
        this.emit('views-updated', this);
      },

      addView: function (view) {
        //adds a new view to the viewstack
        view.pageContainer = this;
        if (!this._containsView(view.label)) {
          this.views.push(view);
        }

        var viewStackView = this.viewStack.getViewByLabel(view.label);
        if (!viewStackView) {
          this.viewStack.addView(view);
        }

        this._updateViews();
        this.emit('view-added', view);
      },

      removeViewByTitle: function (title) {
        var view = this.getViewByTitle(title);
        this.removeViewByIndex(view.index);
      },

      removeView: function (view) {
        this.removeViewByIndex(view.index);
      },

      removeViewByIndex: function (idx) {
        var view = this.getViewByIndex(idx);
        var vL = view.label;
        this.viewStack.removeView(view);
        this.views.splice(idx, 1);
        this._updateViews();

        this._backLabels = this._backLabels.filter(function (bl) {
          return bl !== vL;
        });
        if (this._backLabels.length === 0) {
          this.backDisabled = true;
        }
        this._navView('next-view');
        this.emit('view-removed', view);
      },

      _clearViews: function () {
        array.forEach(this.views, lang.hitch(this, function (v) {
          this.viewStack.removeView(v);
        }));
        this.views = [];
        this._backLabels = [];
      },

      _containsView: function (title) {
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          if (view.label === title) {
            return true;
          }
        }
        return false;
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.styleColor = styleColor;
        }));
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        this._updateImageNode(isDark, 'bg-back-img', 'bg-back-img-white');
        this._updateImageNode(isDark, 'bg-home-img', 'bg-home-img-white');
        this._updateImageNode(isDark, 'bg-next-img', 'bg-next-img-white');
      },

      _updateDomNodes: function (index) {
        //get the current view
        var currentView = this.views[index];

        ////This type of approch needs to occur to support the ability to return to a parent list
        var homeIndex = this._homeIndex;
        var backDisabled = this.backDisabled ? this.backDisabled : index === this._homeIndex ? true : false;
        this._updateControl(this.backTd, backDisabled);
        this._updateControl(this.backImage, backDisabled);

        var homeDisabled = index === homeIndex ? true : index + 1 === this.views.length ? false : false;
        this._updateControl(this.homeTd, homeDisabled);
        this._updateControl(this.homeImage, homeDisabled);

        //nextDisabled is so a view can flag it to prevent navigation until the user does something or force it
        // to be enabled if view supports an altNextIndex that would allow it to not just go to next view in the stack
        var hasAltNextIndex = currentView && typeof (currentView.altNextIndex) !== 'undefined';
        var nextDisabled = this.nextDisabled ? this.nextDisabled : (index === homeIndex) && !this.nextDisabled ?
          false : hasAltNextIndex ? false : this.nextDisabled;
        this._updateControl(this.nextTd, nextDisabled);
        this._updateControl(this.nextImage, nextDisabled);
      },

      _updateImageNode: function (isDark, img, imgWhite) {
        var removeClass = isDark ? img : imgWhite;
        var addClass = isDark ? imgWhite : img;
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      _updateViewTheme: function (theme) {
        this.theme = theme;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.theme = theme;
        }));
      },

      toggleController: function (isDisabled) {
        if (this.controlTable) {
          if (isDisabled) {
            if (!domClass.contains(this.controlTable, 'display-none')) {
              domClass.add(this.controlTable, 'display-none');
            }
          } else {
            if (domClass.contains(this.controlTable, 'display-none')) {
              domClass.remove(this.controlTable, 'display-none');
            }
          }
        }
      },

      reset: function () {
        this._clearViews();
        this.views = [];
        this._currentIndex = -1;
        this._homeIndex = 0;
        this.nextDisabled = false;
        this.backDisabled = true;
        this.selected = '';
        this.updateImageNodes();
      }
    });
  });