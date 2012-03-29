var wax = wax || {};
wax.tooltip = {};

wax.tooltip = function() {
    var popped = false,
        animate = false,
        t = {},
        tooltips = [],
        parent;

    // Get the active tooltip for a layer or create a new one if no tooltip exists.
    // Hide any tooltips on layers underneath this one.
    function getTooltip(feature) {
        var tooltip = document.createElement('div');
        tooltip.className = 'wax-tooltip wax-tooltip-0';
        tooltip.innerHTML = feature;
        return tooltip;
    }

    // Hide a given tooltip.
    function hide() {
        var event;

        function remove() {
            if (this.parentNode) this.parentNode.removeChild(this);
        }

        if (document.body.style['-webkit-transition'] !== undefined) {
            event = 'webkitTransitionEnd';
        } else if (document.body.style.MozTransition !== undefined) {
            event = 'transitionend';
        }

        var _ct;
        while (_ct = tooltips.pop()) {
            if (animate && event) {
                // This code assumes that transform-supporting browsers
                // also support proper events. IE9 does both.
                  bean.add(_ct, event, remove);
                  _ct.className += ' wax-fade';
            } else {
                if (_ct.parentNode) _ct.parentNode.removeChild(_ct);
            }
        }
    }

    function on(o) {
        var content;
        hide();
        if ((o.e.type === 'mousemove' || !o.e.type) && !popped) {
            content = o.formatter({ format: 'teaser' }, o.data);
            if (!content) return;
            parent.style.cursor = 'pointer';
            tooltips.push(parent.appendChild(getTooltip(content)));
        } else {
            content = o.formatter({ format: 'full' }, o.data);
            if (!content) return;
            var tt = parent.appendChild(getTooltip(content));
            tt.className += ' wax-popup';

            var close = tt.appendChild(document.createElement('a'));
            close.href = '#close';
            close.className = 'close';
            close.innerHTML = 'Close';
            popped = true;

            tooltips.push(tt);

            bean.add(close, 'click touchend', function closeClick(e) {
                e.stop();
                hide();
                popped = false;
            });
        }
    }

    function off() {
        parent.style.cursor = 'default';
        if (!popped) hide();
    }

    t.parent = function(x) {
        if (!arguments.length) return parent;
        parent = x;
        return t;
    };

    t.animate = function(x) {
        if (!arguments.length) return animate;
        animate = x;
        return t;
    };

    t.events = function() {
        return {
            on: on,
            off: off
        };
    };

    return t;
};
