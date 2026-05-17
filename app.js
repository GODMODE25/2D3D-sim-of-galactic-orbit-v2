import * as THREE from 'three';
import { initScene } from './src/scene.js';

/**
 * Initialize the application
 */
let sceneData = null;
/**
 * Accessor for initialized scene data.
 * Note: `sceneData` will be `null` until `init()` has run and the scene is created.
 * Consumers should call `getSceneData()` only after `init()` has completed.
 */
function getSceneData() {
    return sceneData;
}
function init() {
    console.log('Three.js loaded successfully');
    console.log('Three.js version:', THREE.REVISION);

    // Initialize the scene module which sets up renderer, camera, objects and starts animation
    sceneData = initScene();

    // Infocard popup logic
    const infocard = document.getElementById('infocard');
    const infocardTitle = document.getElementById('infocard-title');
    const infocardDescription = document.getElementById('infocard-description');
    const infocardDetails = document.getElementById('infocard-details');
    const infocardClose = document.getElementById('infocard-close');

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let hoveredObject = null;
    let pinnedObject = null;

    function showInfoCard(data, x, y) {
        if (!data) {
            hideInfoCard();
            return;
        }
        infocardTitle.textContent = `${data.emoji} ${data.name}`;
        infocardDescription.textContent = data.description;
        
        infocardDetails.innerHTML = '';
        
        const details = {
            'Mass': data.mass,
            'Diameter': data.diameter,
            'Surface Temp.': data.surfaceTemperature,
            'Orbital Period': data.orbitalPeriodYears ? `${data.orbitalPeriodYears} years` : undefined
        };

        for (const [key, value] of Object.entries(details)) {
            if (value) {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${key}:</strong> ${value}`;
                infocardDetails.appendChild(li);
            }
        }

        infocard.style.left = `${x + 15}px`;
        infocard.style.top = `${y + 15}px`;
        infocard.classList.remove('hidden');
    }

    function hideInfoCard() {
        infocard.classList.add('hidden');
    }

    function getIntersectedObject(event) {
        // Ignore interactions on UI elements
        if (event.target.closest('.dg.main, .control-panel, #infocard')) {
            return null;
        }

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, sceneData.camera);

        // Ensure all interactive objects are included
        const interactiveObjects = [
            sceneData.sun,
            ...sceneData.planets,
            sceneData.galacticOrbit.sagittariusA
        ];
        
        const intersects = raycaster.intersectObjects(interactiveObjects, true);

        if (intersects.length > 0) {
            // Traverse up to find the group/mesh with userData.info
            let obj = intersects[0].object;
            while(obj && !obj.userData.info) {
                obj = obj.parent;
            }
            return obj || null;
        }
        return null;
    }

    function handleMouseMove(event) {
        const intersected = getIntersectedObject(event);
        
        if (pinnedObject) return; // Don't do hover logic if a card is pinned

        if (intersected && intersected !== hoveredObject) {
            hoveredObject = intersected;
            showInfoCard(hoveredObject.userData.info, event.clientX, event.clientY);
        } else if (!intersected && hoveredObject) {
            hoveredObject = null;
            hideInfoCard();
        }
    }

    function handleMouseClick(event) {
        const intersected = getIntersectedObject(event);

        if (intersected) {
            if (pinnedObject && pinnedObject === intersected) {
                // Unpin if clicking the same object again
                pinnedObject = null;
                hideInfoCard();
            } else {
                // Pin new object
                pinnedObject = intersected;
                showInfoCard(pinnedObject.userData.info, event.clientX, event.clientY);
            }
        } else {
            // Clicked away, so unpin and hide
            pinnedObject = null;
            hideInfoCard();
        }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseClick);

    infocardClose.addEventListener('click', (e) => {
        e.stopPropagation();
        pinnedObject = null;
        hideInfoCard();
    });


        // --- NEW: Simplified UI interaction logic ---


    


        // Main toggle button for dat.gui panel


        const togglePanelBtn = document.getElementById('toggle-panel-btn');


        if (togglePanelBtn && sceneData.simulationControls) {


            togglePanelBtn.addEventListener('click', () => {


                sceneData.simulationControls.toggleGuiVisibility();


            });


        }


    


        // Autohide logic for dat.gui panel


        if (sceneData.simulationControls) {


            let autohideTimer = null;


            const resetAutohideTimer = () => {


                if (autohideTimer) clearTimeout(autohideTimer);


                if (sceneData.simulationControls.isPanelAutohide() && !sceneData.simulationControls.isGuiHidden()) {


                    autohideTimer = setTimeout(() => {


                        sceneData.simulationControls.hideGui();


                    }, sceneData.simulationControls.getPanelAutohideDelay());


                }


            };


    


            // Reset timer on general activity


            window.addEventListener('mousemove', resetAutohideTimer, { passive: true });


            window.addEventListener('click', resetAutohideTimer, { passive: true });


            window.addEventListener('keydown', resetAutohideTimer, { passive: true });


    


                        // Initial call


    


                        resetAutohideTimer();


        }


    


        // Update info panel with Three.js version


        const versionSpan = document.getElementById('threejs-version');


        if (versionSpan) {


          versionSpan.textContent = THREE.REVISION;


        }

    console.log('Scene initialized');
}

/**
 * Wait for DOM to be ready, then initialize
 */
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Export for future modules/tests. Prefer `getSceneData()` to avoid reading
// the exported `sceneData` before initialization.
export { init, getSceneData };
