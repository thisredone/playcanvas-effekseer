/*jshint esversion: 6, asi: true, laxbreak: true*/
window._initEffekseerSystem = function(doneCallback) {

if(pc.Application.getApplication() === undefined)
{
    effekseerWasmAssets = [];
}
else
{
    effekseerWasmAssets = pc.Application.getApplication().assets.findAll("effekseer_native.wasm"); 
} 

effekseerWasmLoadingEvents = []
effekseerWasmLoaded = false;
// console.log('effekseerWasmAssets', effekseerWasmAssets);

if(effekseerWasmAssets.length > 0)
{
    effekseer.setImageCrossOrigin("anonymous");

    if (pc.WasmModule.getConfig('effekseer_native')) {
        // console.log("effekseer_native config:", pc.WasmModule.getConfig('effekseer_native'));
    } else {
        const wasmConfig = {
            glueUrl: pc.Application.getApplication().assets.get(effekseerWasmAssets[0]._data.glueScriptId).getFileUrl(),
            wasmUrl: effekseerWasmAssets[0].getFileUrl(),
            fallbackUrl: ''
        };
        // console.log("effekseer_native config:", wasmConfig);
        pc.WasmModule.setConfig('effekseer_native', wasmConfig);
    }

    pc.WasmModule.getInstance("effekseer_native", (instance) => {
        window["effekseer_native"] = instance;

        effekseer.initRuntime(effekseerWasmAssets[0].getFileUrl(), () => {
            var gl = pc.Application.getApplication().graphicsDevice.gl;

            effekseerWasmLoaded = true;
            for(var i = 0; i < effekseerWasmLoadingEvents.length; i++)
            {
                effekseerWasmLoadingEvents[i]();
            }
            doneCallback()
        });
    });
    
}

function addEffekseerWasmLoadingEvent(f)
{
    if(effekseerWasmLoaded)
    {
        f();        
    }
    else
    {
       effekseerWasmLoadingEvents.push(f);        
    }
}

class EffekseerContext
{
    constructor(app) {
        this.context = null;
        this.loaded = false;
        this._events = [];
        
        addEffekseerWasmLoadingEvent(() => {
            this.context = effekseer.createContext();     
            this.context.init(app.graphicsDevice.gl, {enableExtensionsByDefault : false}); 
            this.loaded = true;    
            for(var i = 0; i < this._events.length; i++)
            {
                this._events[i](this);       
            }
        });
    }
    
    release()
    {
        addEffekseerWasmLoadingEvent(() => {
            effekseer.releaseContext(this.context);
        });
    }
    
    addEvent(f)
    {
        if(this.loaded)
        {
            f(this);        
        }
        else
        {
            this._events.push(f);            
        }
    }
}

class PlayCanvasEffekseerSystem
{
    constructor(app) {
        this.context = new EffekseerContext(app);
    }
    
    release()
    {
        this.context.release();
    }
}

window.playCanvasEffekseerSystem = null;
window.playCanvasEffekseerSystemCount = 0;

window.createPlayCanvasEffekseerSystem = function(app) {
    if(window.playCanvasEffekseerSystemCount === 0)
    {
        window.playCanvasEffekseerSystem = new PlayCanvasEffekseerSystem(app);
    }
    window.playCanvasEffekseerSystemCount += 1;
};

window.deletePlayCanvasEffekseerSystem = function() {
    window.playCanvasEffekseerSystemCount -= 1;
    if(window.playCanvasEffekseerSystemCount === 0)
    {
        window.playCanvasEffekseerSystem = null;
    }
};

};


var EffekseerSystem = pc.createScript('effekseerSystem');

EffekseerSystem.attributes.add("Camera",  {
    type: 'entity'
});

// My Uranus patch
EffekseerSystem.attributes.add("inEditor",  {
    type: 'boolean',
    default: true,
});

EffekseerSystem.prototype.editorInitialize = function() {
    if (this._editorInitializeCalled) return;
    this._editorInitializeCalled = true;
    let i;
    i = setInterval(() => {
        if (window.effekseer) {
            window._initEffekseerSystem(() => {
                window.effekseerActive = true;
                this.initialize()
            })
            clearInterval(i);
        }
    }, 100)
    if (window.Uranus?.Editor) {
        this.Camera = editor.call('camera:current');
        setInterval(() => {
            this.Camera = editor.call('camera:current');
        }, 100)
    }
}
// End patch

EffekseerSystem.prototype.initialize = function() {
    if (!window.effekseerActive) return this.editorInitialize();
    window.createPlayCanvasEffekseerSystem(this.app);
    
    var theObj = this;
    var layer = new pc.Layer({
        name : "effekseerlayer",
            onPostRenderTransparent : function (camerapass) {
                if(window.playCanvasEffekseerSystem.context.loaded)
                {
                    window.playCanvasEffekseerSystem.context.context.draw();                        
                }
            }
        });
    
    this.layer = layer;
        
    var worldLayer = this.app.scene.layers.getLayerByName("World");
    var idx = this.app.scene.layers.getTransparentIndex(worldLayer);
    this.app.scene.layers.insertTransparent(layer, idx + 1);
    
     
    // add layer to a camera
    var camera = this.Camera.camera;
    var layers = camera.layers.concat();
    layers.push(layer.id);
    camera.layers = layers;
    
    this.on("destroy", function () {
        window.deletePlayCanvasEffekseerSystem();
    });
    
    this._restTime = 0.0;
};

EffekseerSystem.prototype.update = function(dt) {
    if (!window.effekseerActive) return;
    var context = window.playCanvasEffekseerSystem.context;
    if(context.loaded)
    {
        var camera = this.Camera.camera;
        this._restTime += dt;
        
        while(this._restTime >= 1.0 / 60.0) {
            context.context.update(1);
            this._restTime -= 1.0 / 60.0;
        }
        context.context.setProjectionMatrix(camera.projectionMatrix.data);
        context.context.setCameraMatrix(camera.viewMatrix.data);    
    }
};
