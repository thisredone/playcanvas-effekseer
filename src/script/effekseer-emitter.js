/*jshint esversion: 6, asi: true, laxbreak: true*/

var EffekseerEmitter = pc.createScript('effekseerEmitter');

EffekseerEmitter.attributes.add("effect", {
    type: 'asset',
    assetType: 'binary'
});

EffekseerEmitter.attributes.add("playOnEnter", {
    type: 'boolean'
});

EffekseerEmitter.attributes.add("scale", {
    type: 'number',
    default: 1.0,
});


// My Uranus patch
EffekseerEmitter.attributes.add("inEditor", {
    type: 'boolean',
    default: true,
});

EffekseerEmitter.prototype.editorInitialize = function () {
    if (this._editorInitializeCalled) return;
    this._editorInitializeCalled = true;
    let i;
    i = setInterval(() => {
        if (window.effekseerActive) {
            clearInterval(i);
            this.initialize()
        }
    }, 100)
}
// End patch

EffekseerEmitter.prototype.initialize = function () {
    if (!window.effekseerActive) return this.editorInitialize();
    if (this.effect) {
        theApp = this.app;
        var redirectFuc = function redirect(src) {
            var srcs = src.split('/');
            var filename = srcs[srcs.length - 1];
            var assets = theApp.assets.findAll(filename);

            if (assets.length === 0) return src;

            for (var i = 0; i < assets.length; i += 1) {
                var url = assets[i].getFileUrl();
                return url;
            }
            return src;
        };


        // console.log(this.effect);
        // console.log(this.effect.getFileUrl());
        var context = window.playCanvasEffekseerSystem.context;

        context.addEvent((c) => {
            this.effekseer_effect = c.context.loadEffect(this.effect.getFileUrl(), this.scale, () => { }, () => { }, redirectFuc);
        });
    }

    // TODO : it is better to wait or find effekseer system
    this.on("destroy", function () {
        if (this.effekseer_effect.isLoaded) {
            var context = window.playCanvasEffekseerSystem.context;
            var handle = context.context.releaseEffect(this.effekseer_effect);
            this.effekseer_effect = null;
        }
        // window.deletePlayCanvasEffekseerSystem();
    });

    this._handles = [];
    this._commands = [];

    if (this.playOnEnter) {
        this.play();
    }
    this._ready = true;

    if (window.Uranus?.Editor) {
        this.on('attr:scale', () => {
            this._handles.forEach(h => h.stop());
            this._commands = [];
            this._handles = [];
            this.play(pc.Vec3.ZERO, this.scale);
        })
    }
};

EffekseerEmitter.prototype.update = function (dt) {
    if (!this._ready) return;
    // execute commands
    if (this.effekseer_effect && this.effekseer_effect.isLoaded) {
        this._commands.forEach(function (v) { v(); });
        this._commands = [];
    }

    // remove finished handles
    this._handles = this._handles.filter(function (item) {
        return item.exists;
    });

    //
    // Commented-out since we'll use one emitter per effect (all effects of this type will be handled by a single entity)
    //
    // // update transforms
    // for(var i = 0; i < this._handles.length; i++)
    // {
    //     var transform = this.entity.getWorldTransform();
    //     // this._handles[i].setMatrix(Array.prototype.slice.call(transform.data));
    //     this._handles[i].setMatrix(transform.data);
    // }
};

EffekseerEmitter.prototype.play = function (pos = pc.Vec3.ZERO, scale = this.scale) {

    var f = function () {
        var context = window.playCanvasEffekseerSystem.context;
        var handle = context.context.play(this.effekseer_effect, pos.x, pos.y, pos.z);
        handle.setScale(scale, scale, scale);
        // handle.setLocation(pos.x, pos.y, pos.z);
        // var transform = this.entity.getWorldTransform();
        // handle.setMatrix(Array.prototype.slice.call(transform.data));
        // handle.setMatrix(transform.data);
        this._handles.push(handle);
    }.bind(this);

    if (this.effekseer_effect && this.effekseer_effect.isLoaded) {
        f();
    }
    else {
        // execute delay
        this._commands.push(f);
    }
};
