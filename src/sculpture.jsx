import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export default function Sculpture(){const host=useRef();useEffect(()=>{let renderer,frame;try{
 const el=host.current,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,0,8);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;el.appendChild(renderer.domElement);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;
 const group=new THREE.Group();scene.add(group);
 const metal=new THREE.MeshPhysicalMaterial({color:0x8b9690,metalness:1,roughness:.19,clearcoat:1});
 const geometry=new THREE.TorusKnotGeometry(1.35,.36,192,32,2,3),mesh=new THREE.Mesh(geometry,metal);mesh.rotation.set(.4,-.5,.15);group.add(mesh);
 const glass=new THREE.MeshPhysicalMaterial({color:0xa6b6a7,transmission:.92,thickness:1.4,roughness:.12,metalness:0,ior:1.5,transparent:true,opacity:.65});
 const ringGeom=new THREE.TorusGeometry(1.85,.16,24,120),ring=new THREE.Mesh(ringGeom,glass);ring.rotation.set(1.1,.45,-.4);group.add(ring);group.rotation.z=-.35;
 scene.add(new THREE.AmbientLight(0xffffff,1.4));const light=new THREE.DirectionalLight(0xfaf9ed,3);light.position.set(3,4,5);scene.add(light);
 const resize=()=>{const {width,height}=el.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const start=performance.now();const draw=()=>{if(!document.hidden){const t=(performance.now()-start)*.0001;if(!reduced){group.rotation.y=Math.sin(t)*.3;group.position.y=Math.sin(t*2)*.09;}renderer.render(scene,camera);}frame=requestAnimationFrame(draw);};draw();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();geometry.dispose();ringGeom.dispose();metal.dispose();glass.dispose();env.dispose();room.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();};
 }catch{return()=>{if(frame)cancelAnimationFrame(frame);renderer?.dispose();};}},[]);return <div className="sculpture" aria-hidden="true" ref={host}/>;}
