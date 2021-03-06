(function(Site) {

    var Snipt = snipt.module('snipt');

    Backbone.oldSync = Backbone.sync;
    Backbone.Model.prototype.idAttribute = 'resource_uri';
    var addSlash = function(str) {
        return str + ((str.length > 0 && str.charAt(str.length - 1) === '/') ? '' : '/');
    };
    Backbone.sync = function(method, model, options) {
        options.headers = _.extend({
            'Authorization': 'ApiKey ' + window.user + ':' + window.api_key
        }, options.headers);
        return Backbone.oldSync(method, model, options);
    };
    Backbone.Model.prototype.url = function() {
        var url = this.id;
        if (!url) {
            url = this.urlRoot;
            url = url || this.collection && (_.isFunction(this.collection.url) ? this.collection.url() : this.collection.url);

            if (url && this.has('id')) {
                url = addSlash(url) + this.get('id');
            }
        }
        url = url && addSlash(url);

        if (typeof url === 'undefined') {
            url = '/api/private/snipt/';
            this.unset('id', {'silent': true});
            this.unset('user', {'silent': true});
        }
        return url || null;
    };

    Site.SiteView = Backbone.View.extend({
        el: 'body',

        initialize: function(opts) {

            this.$body = $(this.el);
            this.$html = $('html');
            this.$html_body = this.$body.add(this.$html);
            this.$aside_main = $('aside.main', this.$body);
            this.$aside_nav = $('aside.nav', this.$body);
            this.$aside_nav_ul = $('ul', this.$aside_nav);
            this.$search_form = $('form.search', this.$body);
            this.$search_query = $('input#search-query', this.$body);
            this.$search_page_query = $('input.search-query', this.$body);
            this.$search_queries = this.$search_query.add(this.$search_page_query);
            this.$snipts = $('section#snipts article.snipt', this.$body);
            this.$modals = $('div.modal', this.$snipts);
            this.$main_edit = $('section#main-edit');
            this.$main = $('section#main');
            this.$keyboard_shortcuts = $('#keyboard-shortcuts', this.$body);

            this.keyboardShortcuts();
            this.inFieldLabels();

            var SniptListView = Snipt.SniptListView;
            this.snipt_list = new SniptListView({ 'snipts': this.$snipts });

            var that = this;

            this.$body.click(function() {
                if (!window.ui_halted && !window.from_modal && window.$selected) {
                    window.$selected.trigger('deselect');
                }
                if (window.from_modal) {
                    window.from_modal = false;
                }
                that.$aside_nav.removeClass('open');
            });

            this.$aside_nav_ul.click(function(e) {
                e.stopPropagation();
            });

            $search_queries = this.$search_queries;
            $search_queries.focus(function() {
                if (window.$selected) {
                    $selected.trigger('deselect');
                }
            });

            this.$body.on('click', 'a.close', function() {
                $(this).parent().parent().modal('hide');
                window.ui_halted = false;
                return false;
            });

            this.$keyboard_shortcuts.on('hidden', function() {
                window.ui_halted = false;
            });

            if (this.$body.hasClass('pro-signup')) {
                var $form = $('form#pro-signup');
                var $submit = $('button[type="submit"]', $form);

                var $name = $('input#name');
                var $cardNumber = $('input#number');
                var $expMonth = $('select#exp-month');
                var $expYear = $('select#exp-year');
                var $cvc = $('input#cvc');

                $form.submit(function() {

                    $submit.attr('disabled', 'disabled');

                    var errors = false;

                    if (!Stripe.validateCardNumber($cardNumber.val())) {
                        $cardNumber.parents('div.control-group').addClass('error');
                        errors = true;
                    } else {
                        $cardNumber.parents('div.control-group').removeClass('error');
                    }

                    if (!Stripe.validateExpiry($expMonth.val(), $expYear.val())) {
                        $expMonth.parents('div.control-group').addClass('error');
                        errors = true;
                    } else {
                        $expMonth.parents('div.control-group').removeClass('error');
                    }

                    if (!Stripe.validateCVC($cvc.val())) {
                        $cvc.parents('div.control-group').addClass('error');
                        errors = true;
                    } else {
                        $cvc.parents('div.control-group').removeClass('error');
                    }

                    if (!errors) {

                        $('.payment-errors').hide();
                        $('.payment-loading').show();

                        Stripe.createToken({
                            name: $name.val(),
                            number: $cardNumber.val(),
                            cvc: $cvc.val(),
                            exp_month: $expMonth.val(),
                            exp_year: $expYear.val()
                        }, that.stripeResponseHandler);

                    } else {
                        $submit.removeAttr('disabled');
                    }

                    return false;
                });
            }

            if (this.$body.hasClass('login')) {
                $('input#id_username').focus();
            }

            // Populate any GitTip widgets.
            if (window.gittip_username) {
                this.$aside_main.html(this.$aside_main.html().replace(
                   /\[\[.*gittip.*\]\]/,
                   '<iframe style="border: 0; margin: 0; padding: 0;" src="https://www.gittip.com/' + window.gittip_username + '/widget.html" width="48pt" height="22pt"></iframe>')
                );
                $('iframe', this.$aside_main).parent('p').prev('p').css('margin-bottom', '10px');
            }

            window.ui_halted = false;
        },
        events: {
            'showKeyboardShortcuts': 'showKeyboardShortcuts',
            'click a.mini-profile':  'toggleMiniProfile'
        },

        keyboardShortcuts: function() {
            var $body = this.$body;

            var that = this;

            $search_queries = this.$search_queries;
            $search_page_query = this.$search_page_query;
            $search_query = this.$search_query;
            $document = $(document);

            $document.bind('keydown', '/', function(e) {
                if (!window.ui_halted) {
                    e.preventDefault();
                    if ($body.hasClass('search')) {
                        $search_page_query.focus();
                    } else {
                        $search_query.focus();
                    }
                }
            });
            $document.bind('keydown', 'h', function(e) {
                if (!window.ui_halted) {
                    window.ui_halted = true;
                    $body.trigger('showKeyboardShortcuts');
                } else {
                    if (that.$keyboard_shortcuts.is(':visible')) {
                        that.$keyboard_shortcuts.modal('hide');
                    }
                }
            });
            $document.bind('keydown', 't', function(e) {
                if (!window.ui_halted) {
                    window.open('', '_blank');
                }
            });
            $document.bind('keydown', 'r', function(e) {
                if (!window.ui_halted) {
                    location.reload(true);
                }
            });
            $document.bind('keydown', 'Ctrl+h', function(e) {
                if (!window.ui_halted) {
                    history.go(-1);
                }
            });
            $document.bind('keydown', 'Ctrl+l', function(e) {
                if (!window.ui_halted) {
                    history.go(1);
                }
            });
            this.$search_queries.bind('keydown', 'esc', function(e) {
                if (!window.ui_halted) {
                    e.preventDefault();
                    this.blur();
                }
            });
        },
        showKeyboardShortcuts: function() {
            this.$keyboard_shortcuts.modal('toggle');
        },
        toggleMiniProfile: function(e) {
            this.$aside_nav.toggleClass('open');
            return false;
        },
        inFieldLabels: function () {
            $('div.infield label', this.$body).inFieldLabels({
                fadeDuration: 200
            });
        },
        stripeResponseHandler: function(status, response) {

            var $form = $('form#pro-signup');

            if (response.error) {
                $('button[type="submit"]', $form).removeAttr('disabled');
                $('.payment-loading').hide();
                $('.payment-errors').text(response.error.message).show();
            } else {
                var token = response.id;

                // Kill all of the form details so none of it touches our server.
                // Note, this is unnecessary, because the inputs themselves do not
                // have a name attr, meaning they'll never get sent to begin with.
                $('input#name').val('');
                $('input#number').val('');
                $('select#exp-month').val('');
                $('select#exp-year').val('');
                $('input#cvc').val('');

                $form.append("<input type='hidden' name='token' value='" + token + "'/>");
                $form.get(0).submit();
            }
        }
    });

})(snipt.module('site'));
