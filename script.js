"use strict";
const STATE={vehicles:[],drivers:[],trips:[],maintenance:[],inspections:[],licenses:[],insurance:[],notifications:[]};
const PASS="hamo2006";

// ===== FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyCMz8ALg3brQ0hGd11KDZFLL3sUWaM7-5s",
  authDomain: "elkhal-system.firebaseapp.com",
  projectId: "elkhal-system",
  storageBucket: "elkhal-system.firebasestorage.app",
  messagingSenderId: "625217586868",
  appId: "1:625217586868:web:66ad9bd40a4dda6a7f39e1",
  measurementId: "G-EG4CK3ZQL0"
};
let db=null;
try{
  firebase.initializeApp(firebaseConfig);
  db=firebase.firestore();
}catch(e){console.error("Firebase init error",e);}
const CLOUD_DOC="main";
function cleanForFirebase(value){
  if(value === undefined || value === null) return "";
  if(typeof value === "string" || typeof value === "number" || typeof value === "boolean"){
    return value;
  }
  if(Array.isArray(value)){
    return value.map(cleanForFirebase);
  }
  if(typeof HTMLElement !== "undefined" && value instanceof HTMLElement){
    return "";
  }
  if(typeof File !== "undefined" && value instanceof File){
    return "";
  }
  if(typeof value === "object"){
    const cleaned = {};
    Object.keys(value).forEach(key=>{
      cleaned[key] = cleanForFirebase(value[key]);
    });
    return cleaned;
  }
  return "";
}
 async function saveToCloud(){
  try{
    if(!db){
      showToast("❌ Firebase مش متصل","error");
      return;
    }
    const profileRaw = JSON.parse(localStorage.getItem("fleet_profile") || "{}");

    const profile = {
      ...profileRaw,
      photo: ""
    };
    const dataToSave = cleanForFirebase({
      state: STATE,
      profile: profile
    });
    await db.collection("fleetData").doc(CLOUD_DOC).set({
      ...dataToSave,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("✅ تم حفظ البيانات على Firebase");
  }catch(e){
    console.error(e);
    showToast("❌ فشل حفظ البيانات","error");
  }
}
async function loadFromCloud(){
  try{
    if(!db)return;
    const snap=await db.collection("fleetData").doc(CLOUD_DOC).get();
    if(!snap.exists)return;
    const data=snap.data()||{};
    if(data.state){Object.keys(data.state).forEach(k=>{if(STATE[k]!==undefined)STATE[k]=data.state[k]||[];});saveToStorage();}
    if(data.profile){localStorage.setItem("fleet_profile",JSON.stringify(data.profile));loadProfile();}
    renderAll();checkAllExpiry();showToast("☁️ تم تحميل البيانات من Firebase");
  }catch(e){console.error(e);}
}

const TITLES={dashboard:"لوحة التحكم",profile:"الملف الشخصي",vehicles:"العربيات والبراد",drivers:"السواقين",accounts:"الحسابات",maintenance:"الصيانة",inspection:"الفحص الدوري",license:"الترخيص",insurance:"التأمين",notifications:"التنبيهات"};

window.addEventListener("DOMContentLoaded",()=>{
  initLock();
  loadFromStorage();
  loadProfile();
  renderAll();
  loadFromCloud();
  checkAllExpiry();
  requestNotifPermission();
  loadCurrencyRates();
  setInterval(checkAllExpiry,60*60*1000);
  setInterval(loadCurrencyRates,60*60*1000);
  // إشعار عند الفتح لو في حاجة منتهية
  setTimeout(checkAndNotify,2000);
  // Expose globals for Firebase listener
  window._STATE=STATE;
  window._renderAll=renderAll;
  window._checkAllExpiry=checkAllExpiry;
});

// ===== LOCK =====
function initLock(){
  const input = document.getElementById("lock-input");
  if(input){
    input.removeAttribute("maxlength");
    input.maxLength = 20;
    input.setAttribute("autocomplete","off");
  }

  const unlocked=localStorage.getItem("fleet_unlocked")==="true";
  if(!unlocked){
    document.getElementById("lock-screen").classList.remove("hidden");
  } else {
    document.getElementById("lock-screen").classList.add("hidden");
  }

}
function checkLock(){
  const val=document.getElementById("lock-input").value;
  const err=document.getElementById("lock-error");
  if(val===PASS){
    localStorage.setItem("fleet_unlocked","true");
    document.getElementById("lock-screen").classList.add("hidden");
    document.getElementById("lock-input").value="";
    err.classList.add("hidden");
    showToast("✅ أهلاً يا خال!");
  } else {
    err.classList.remove("hidden");
    document.getElementById("lock-input").value="";
    document.getElementById("lock-input").focus();
    setTimeout(()=>err.classList.add("hidden"),2500);
  }
}
function lockApp(){
  if(!confirm("هتقفل الموقع — متأكد؟"))return;
  localStorage.setItem("fleet_unlocked","false");
  document.getElementById("lock-screen").classList.remove("hidden");
  document.getElementById("lock-input").value="";
}

// ===== STORAGE =====
function saveToStorage(){localStorage.setItem("fleet_v2",JSON.stringify(STATE));}
function loadFromStorage(){const r=localStorage.getItem("fleet_v2");if(r){try{const p=JSON.parse(r);Object.keys(p).forEach(k=>{if(STATE[k]!==undefined)STATE[k]=p[k];});}catch(e){}}}

// ===== PROFILE =====
function loadProfile(){
  const p=JSON.parse(localStorage.getItem("fleet_profile")||"{}");
  if(p.photo)setProfilePhoto(p.photo);
}
function setProfilePhoto(src){
  const img=document.getElementById("profile-img");const tb=document.getElementById("topbar-photo");
  const ini=document.getElementById("profile-initials-big");const tini=document.getElementById("topbar-initials");
  if(src){img.src=src;img.style.display="block";if(ini)ini.style.display="none";if(tb){tb.src=src;tb.style.display="block";}if(tini)tini.style.display="none";}
}
function uploadPhoto(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{const src=ev.target.result;setProfilePhoto(src);const p=JSON.parse(localStorage.getItem("fleet_profile")||"{}");p.photo=src;localStorage.setItem("fleet_profile",JSON.stringify(p));showToast("✅ تم رفع الصورة");};
  reader.readAsDataURL(file);
}

// ===== NAV =====
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  const pg=document.getElementById("page-"+id);if(pg)pg.classList.add("active");
  const btn=document.querySelector(`[data-page="${id}"]`);if(btn)btn.classList.add("active");
  document.getElementById("page-title").textContent=TITLES[id]||"";
  if(window.innerWidth<=700)closeSidebar();
  if(["inspection","insurance"].includes(id))populateVehicleSelects();
  if(id==="vehicles")populateDriverSelects();
  if(id==="accounts"){populateAccFilter();renderAccounts();}
  if(id==="maintenance"){updateMaintEntity();}
  if(id==="license"){updateLicEntity();}
}
function toggleSidebar(){document.getElementById("sidebar").classList.toggle("open");}
function closeSidebar(){document.getElementById("sidebar").classList.remove("open");}

// ===== MODAL =====
function openModal(id){
  populateAllDropdowns();
  document.getElementById(id).classList.add("active");
  if(id==="modal-add-maintenance")updateMaintEntity();
  if(id==="modal-add-license")updateLicEntity();
}
function closeModal(id){document.getElementById(id).classList.remove("active");}
window.addEventListener("click",e=>{if(e.target.classList.contains("modal-overlay"))e.target.classList.remove("active");});
window.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-overlay.active").forEach(m=>m.classList.remove("active"));});

// ===== TOAST =====
let _tt;
function showToast(msg,type="success"){const t=document.getElementById("toast");t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove("show"),3000);}
function showAlertBar(msg){document.getElementById("alert-bar-text").textContent=msg;document.getElementById("alert-bar").classList.remove("hidden");}
function closeAlertBar(){document.getElementById("alert-bar").classList.add("hidden");}

// ===== HELPERS =====
function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,4);}
function getVal(id){const el=document.getElementById(id);return el?el.value.trim():"";}
function setVal(id,v){const el=document.getElementById(id);if(el)el.value=v!=null?v:"";}
function num(v){return parseFloat(v)||0;}
function fmtNum(n){return n%1===0?n.toString():n.toFixed(2);}
function daysUntil(d){if(!d)return null;const t=new Date();t.setHours(0,0,0,0);const x=new Date(d);x.setHours(0,0,0,0);return Math.ceil((x-t)/86400000);}
function formatDate(d){if(!d)return"—";return new Date(d).toLocaleDateString("ar-EG",{year:"numeric",month:"short",day:"numeric"});}
function expiryStatus(d){const days=daysUntil(d);if(days===null)return{label:"—",cls:""};if(days<0)return{label:`منتهي منذ ${Math.abs(days)} يوم`,cls:"s-danger"};if(days<=30)return{label:`ينتهي خلال ${days} يوم`,cls:"s-warning"};return{label:"سليم",cls:"s-active"};}
function filterTable(tid,q){document.getElementById(tid).querySelectorAll("tbody tr").forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?"":"none";});}
function getChecked(c){return[...c.querySelectorAll("input[type=checkbox]:checked")].map(x=>x.value);}
function setChecked(c,vals=[]){c.querySelectorAll("input[type=checkbox]").forEach(x=>x.checked=vals.includes(x.value));}
function getVehicleName(id){const v=STATE.vehicles.find(x=>x.id===id);return v?v.plate:"—";}
function getDriverName(id){const d=STATE.drivers.find(x=>x.id===id);return d?d.name:"—";}
function getTrailerName(id){const v=STATE.vehicles.find(x=>x.id===id);return v&&v.trailerNum?`براد ${v.trailerNum}`:"—";}

// ===== POPULATE DROPDOWNS =====
function populateAllDropdowns(){
  populateVehicleSelects();
  populateDriverSelects();
  populateAccFilter();
}
function populateVehicleSelects(){
  const ids=["ins-vehicle","ins2-vehicle","eins-vehicle","ei-vehicle","trip-vehicle","et-vehicle"];
  ids.forEach(id=>{const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">-- اختر --</option>`+STATE.vehicles.map(v=>`<option value="${v.id}">${v.plate}${v.type?" — "+v.type:""}</option>`).join("");});
}
function populateDriverSelects(){
  const ids=["v-driver","ev-driver","trip-driver","et-driver"];
  ids.forEach(id=>{const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">-- بدون سائق --</option>`+STATE.drivers.map(d=>`<option value="${d.id}">${d.name}</option>`).join("");});
}
function populateAccFilter(){
  const s=document.getElementById("acc-vehicle-id");if(!s)return;
  s.innerHTML=`<option value="">-- الكل --</option>`+STATE.vehicles.map(v=>`<option value="${v.id}">${v.plate}${v.type?" — "+v.type:""}</option>`).join("");
}
function updateMaintEntity(){
  const type=getVal("m-entity-type");const s=document.getElementById("m-entity-id");if(!s)return;
  if(type==="vehicle"){s.innerHTML=STATE.vehicles.length?STATE.vehicles.map(v=>`<option value="${v.id}">${v.plate}</option>`).join(""):`<option value="">لا توجد عربيات</option>`;}
  else{const withTrailer=STATE.vehicles.filter(v=>v.trailerNum);s.innerHTML=withTrailer.length?withTrailer.map(v=>`<option value="${v.id}">براد ${v.trailerNum} (${v.plate})</option>`).join(""):`<option value="">لا يوجد براد</option>`;}
}
function updateLicEntity(){
  const type=getVal("lic-entity-type");const s=document.getElementById("lic-entity-id");if(!s)return;
  if(type==="vehicle"){s.innerHTML=STATE.vehicles.length?STATE.vehicles.map(v=>`<option value="${v.id}">${v.plate}</option>`).join(""):`<option value="">لا توجد عربيات</option>`;}
  else{const wt=STATE.vehicles.filter(v=>v.trailerNum);s.innerHTML=wt.length?wt.map(v=>`<option value="${v.id}">براد ${v.trailerNum} (${v.plate})</option>`).join(""):`<option value="">لا يوجد براد</option>`;}
}
function updateElicEntity(){
  const type=getVal("el-entity-type");const s=document.getElementById("el-entity-id");if(!s)return;
  if(type==="vehicle"){s.innerHTML=STATE.vehicles.map(v=>`<option value="${v.id}">${v.plate}</option>`).join("");}
  else{const wt=STATE.vehicles.filter(v=>v.trailerNum);s.innerHTML=wt.map(v=>`<option value="${v.id}">براد ${v.trailerNum} (${v.plate})</option>`).join("");}
}
function autoFillDriver(){
  const vid=getVal("trip-vehicle");
  const v=STATE.vehicles.find(x=>x.id===vid);
  if(v&&v.driver){setVal("trip-driver",v.driver);}
}

// ===== STATUS CLS =====
function vCls(s){return s==="نشطة"?"s-active":s==="في الصيانة"?"s-info":"s-danger";}
function dCls(s){return s==="نشط"?"s-active":s==="إجازة"?"s-info":"s-danger";}
function mCls(s){return s==="مكتملة"?"s-active":s==="جارية"?"s-info":"s-warning";}
function rCls(s){return s==="ناجح"?"s-active":s==="راسب"?"s-danger":"s-warning";}

function renderAll(){renderVehicles();renderDrivers();renderMaintenance();renderInspections();renderLicenses();renderInsurance();updateDashboard();}

// ===== VEHICLES + TRAILERS =====
function addVehicle(){
  const plate=getVal("v-plate"),type=getVal("v-type");
  if(!plate||!type){showToast("⚠️ يرجى ملء الحقول الإلزامية","warning");return;}
  STATE.vehicles.push({id:genId(),plate,type,model:getVal("v-model"),driver:getVal("v-driver"),status:getVal("v-status")||"نشطة",trailerNum:getVal("v-trailer-num"),trailerType:getVal("v-trailer-type"),trailerLic:getVal("v-trailer-lic"),trailerLicExp:getVal("v-trailer-lic-exp"),trailerLicCountry:getVal("v-trailer-lic-country")});
  saveToStorage();renderVehicles();updateDashboard();checkAllExpiry();
  closeModal("modal-add-vehicle");["v-plate","v-type","v-model","v-trailer-num","v-trailer-type","v-trailer-lic","v-trailer-lic-exp"].forEach(i=>setVal(i,""));
  showToast(`✅ تم إضافة العربية ${plate}`);
}
function editVehicle(id){
  const v=STATE.vehicles.find(x=>x.id===id);if(!v)return;
  populateDriverSelects();
  setVal("ev-id",v.id);setVal("ev-plate",v.plate);setVal("ev-type",v.type);setVal("ev-model",v.model);
  setVal("ev-trailer-num",v.trailerNum);setVal("ev-trailer-type",v.trailerType);setVal("ev-trailer-lic",v.trailerLic);setVal("ev-trailer-lic-exp",v.trailerLicExp);
  document.getElementById("ev-driver").value=v.driver||"";document.getElementById("ev-status").value=v.status||"نشطة";
  if(document.getElementById("ev-trailer-lic-country"))document.getElementById("ev-trailer-lic-country").value=v.trailerLicCountry||"الأردن";
  openModal("modal-edit-vehicle");
}
function saveEditVehicle(){
  const id=getVal("ev-id");const i=STATE.vehicles.findIndex(x=>x.id===id);if(i<0)return;
  STATE.vehicles[i]={...STATE.vehicles[i],plate:getVal("ev-plate"),type:getVal("ev-type"),model:getVal("ev-model"),driver:getVal("ev-driver"),status:getVal("ev-status"),trailerNum:getVal("ev-trailer-num"),trailerType:getVal("ev-trailer-type"),trailerLic:getVal("ev-trailer-lic"),trailerLicExp:getVal("ev-trailer-lic-exp"),trailerLicCountry:getVal("ev-trailer-lic-country")};
  saveToStorage();renderVehicles();updateDashboard();checkAllExpiry();closeModal("modal-edit-vehicle");showToast("✅ تم تعديل بيانات العربية");
}
function deleteVehicle(id){
  if(!confirm("حذف العربية؟"))return;STATE.vehicles=STATE.vehicles.filter(v=>v.id!==id);
  saveToStorage();renderVehicles();updateDashboard();showToast("🗑️ تم الحذف","error");
}
function renderVehicles(){
  const tb=document.getElementById("vehicles-tbody");
  document.getElementById("stat-vehicles").textContent=STATE.vehicles.length;
  document.getElementById("stat-trailers").textContent=STATE.vehicles.filter(v=>v.trailerNum).length;
  if(!STATE.vehicles.length){tb.innerHTML=`<tr><td colspan="10" class="empty-state">لا توجد عربيات مضافة</td></tr>`;return;}
  tb.innerHTML=STATE.vehicles.map((v,i)=>{
    const tlicSt=v.trailerLicExp?expiryStatus(v.trailerLicExp):{label:"—",cls:""};
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${v.plate}</strong></td>
      <td data-label="النوع">${v.type||"—"}</td>
      <td data-label="السائق">${getDriverName(v.driver)}</td>
      <td data-label="البراد">${v.trailerNum?`<span class="status-badge s-purple">❄️ ${v.trailerNum}</span>`:"—"}</td>
      <td data-label="نوع البراد">${v.trailerType||"—"}</td>
      <td data-label="ترخيص البراد">${v.trailerLic||"—"}</td>
      <td data-label="انتهاء الترخيص">${v.trailerLicExp?`<span class="status-badge ${tlicSt.cls}">${tlicSt.label}</span>`:"—"}</td>
      <td data-label="الحالة"><span class="status-badge ${vCls(v.status)}">${v.status}</span></td>
      <td>
        <button class="btn-icon" onclick="editVehicle('${v.id}')">✏️ تعديل</button>
        <button class="btn-icon danger" onclick="deleteVehicle('${v.id}')">🗑️</button>
      </td></tr>`;
  }).join("");
}

// ===== DRIVERS =====
function addDriver(){
  const name=getVal("d-name"),phone=getVal("d-phone"),lic=getVal("d-license"),exp=getVal("d-license-exp");
  if(!name||!phone||!lic||!exp){showToast("⚠️ يرجى ملء الحقول الإلزامية","warning");return;}
  STATE.drivers.push({id:genId(),name,phone,idnum:getVal("d-idnum"),nationality:getVal("d-nationality"),license:lic,licenseExp:exp,status:getVal("d-status")||"نشط",notes:getVal("d-notes")});
  saveToStorage();renderDrivers();checkAllExpiry();updateDashboard();
  closeModal("modal-add-driver");["d-name","d-phone","d-idnum","d-license","d-license-exp","d-notes"].forEach(i=>setVal(i,""));
  showToast(`✅ تم إضافة السائق ${name}`);
}
function editDriver(id){
  const d=STATE.drivers.find(x=>x.id===id);if(!d)return;
  setVal("ed-id",d.id);setVal("ed-name",d.name);setVal("ed-phone",d.phone);setVal("ed-idnum",d.idnum);setVal("ed-license",d.license);setVal("ed-license-exp",d.licenseExp);setVal("ed-notes",d.notes);
  document.getElementById("ed-nationality").value=d.nationality||"مصري";document.getElementById("ed-status").value=d.status||"نشط";
  openModal("modal-edit-driver");
}
function saveEditDriver(){
  const id=getVal("ed-id");const i=STATE.drivers.findIndex(x=>x.id===id);if(i<0)return;
  STATE.drivers[i]={...STATE.drivers[i],name:getVal("ed-name"),phone:getVal("ed-phone"),idnum:getVal("ed-idnum"),nationality:getVal("ed-nationality"),license:getVal("ed-license"),licenseExp:getVal("ed-license-exp"),status:getVal("ed-status"),notes:getVal("ed-notes")};
  saveToStorage();renderDrivers();checkAllExpiry();updateDashboard();closeModal("modal-edit-driver");showToast("✅ تم تعديل بيانات السائق");
}
function deleteDriver(id){
  if(!confirm("حذف السائق؟"))return;STATE.drivers=STATE.drivers.filter(d=>d.id!==id);
  saveToStorage();renderDrivers();updateDashboard();showToast("🗑️ تم الحذف","error");
}
function renderDrivers(){
  const tb=document.getElementById("drivers-tbody");
  document.getElementById("stat-drivers").textContent=STATE.drivers.length;
  if(!STATE.drivers.length){tb.innerHTML=`<tr><td colspan="9" class="empty-state">لا يوجد سواقين</td></tr>`;return;}
  tb.innerHTML=STATE.drivers.map((d,i)=>{
    const st=expiryStatus(d.licenseExp);
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${d.name}</strong></td>
      <td data-label="الهاتف">${d.phone}</td>
      <td data-label="رقم الرخصة">${d.license}</td>
      <td data-label="انتهاء الرخصة"><span class="status-badge ${st.cls}">${st.label}</span></td>
      <td data-label="الجنسية">${d.nationality||"—"}</td>
      <td data-label="الحالة"><span class="status-badge ${dCls(d.status)}">${d.status}</span></td>
      <td data-label="ملاحظات">${d.notes||"—"}</td>
      <td>
        <button class="btn-icon" onclick="editDriver('${d.id}')">✏️ تعديل</button>
        <button class="btn-icon danger" onclick="deleteDriver('${d.id}')">🗑️</button>
      </td></tr>`;
  }).join("");
}

// ===== ACCOUNTS (TRIPS) =====
function calcTripNet(){
  const upSa=num(getVal("trip-up-sa")),downSa=num(getVal("trip-down-sa"));
  const wageEg=num(getVal("trip-wage-eg"));
  const expSa=num(getVal("trip-exp-sa")),expEg=num(getVal("trip-exp-eg"));
  const cusSa=num(getVal("trip-cus-sa")),cusEg=num(getVal("trip-cus-eg"));
  const netSa=(upSa+downSa)-expSa-cusSa;
  const netEg=0-wageEg-expEg-cusEg;
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const sc=(id,v)=>{const e=document.getElementById(id);if(e){e.textContent=v;e.style.color=parseFloat(v)>=0?"var(--green)":"var(--red)";}};
  s("prev-up-sa",fmtNum(upSa)+" ر"); s("prev-down-sa",fmtNum(downSa)+" ر");
  s("prev-exp-sa",fmtNum(expSa)+" ر"); s("prev-cus-sa",fmtNum(cusSa)+" ر");
  sc("prev-net-sa",fmtNum(netSa)+" ر");
  s("prev-wage-eg",fmtNum(wageEg)+" ج"); s("prev-exp-eg",fmtNum(expEg)+" ج"); s("prev-cus-eg",fmtNum(cusEg)+" ج");
  sc("prev-net-eg",fmtNum(netEg)+" ج");
}
function addTrip(){
  const vehicle=getVal("trip-vehicle"),date=getVal("trip-date");
  if(!vehicle||!date){showToast("⚠️ اختار العربية والتاريخ","warning");return;}
  const upSa=num(getVal("trip-up-sa")),downSa=num(getVal("trip-down-sa"));
  const wageEg=num(getVal("trip-wage-eg"));
  const expSa=num(getVal("trip-exp-sa")),expEg=num(getVal("trip-exp-eg"));
  const cusSa=num(getVal("trip-cus-sa")),cusEg=num(getVal("trip-cus-eg"));
  const totalSa=upSa+downSa, netSa=totalSa-expSa-cusSa, netEg=0-wageEg-expEg-cusEg;
  STATE.trips.push({id:genId(),vehicle,driver:getVal("trip-driver"),date,upSa,downSa,totalSa,wageEg,expSa,expEg,cusSa,cusEg,netSa,netEg,notes:getVal("trip-notes")});
  saveToStorage();renderAccounts();closeModal("modal-add-trip");
  ["trip-up-sa","trip-down-sa","trip-wage-eg","trip-exp-sa","trip-exp-eg","trip-cus-sa","trip-cus-eg","trip-notes"].forEach(i=>setVal(i,""));
  calcTripNet();showToast("✅ تم إضافة النقلة");
}
function editTrip(id){
  const t=STATE.trips.find(x=>x.id===id);if(!t)return;
  populateVehicleSelects();populateDriverSelects();
  setVal("et-id",t.id);setVal("et-date",t.date);setVal("et-revenue",t.revenue);setVal("et-exp-eg",t.expEg);setVal("et-exp-sa",t.expSa);setVal("et-cus-eg",t.cusEg);setVal("et-cus-sa",t.cusSa);setVal("et-notes",t.notes);
  document.getElementById("et-vehicle").value=t.vehicle;document.getElementById("et-driver").value=t.driver||"";document.getElementById("et-dir").value=t.dir||"طالع";
  openModal("modal-edit-trip");
}
function saveEditTrip(){
  const id=getVal("et-id");const i=STATE.trips.findIndex(x=>x.id===id);if(i<0)return;
  const rev=num(getVal("et-revenue")),expEg=num(getVal("et-exp-eg")),expSa=num(getVal("et-exp-sa")),cusEg=num(getVal("et-cus-eg")),cusSa=num(getVal("et-cus-sa"));
  STATE.trips[i]={...STATE.trips[i],vehicle:getVal("et-vehicle"),driver:getVal("et-driver"),date:getVal("et-date"),dir:getVal("et-dir"),revenue:rev,expEg,expSa,cusEg,cusSa,netEg:rev-expEg-cusEg,netSa:0-expSa-cusSa,notes:getVal("et-notes")};
  saveToStorage();renderAccounts();closeModal("modal-edit-trip");showToast("✅ تم تعديل النقلة");
}
function deleteTrip(id){
  if(!confirm("حذف هذه النقلة؟"))return;STATE.trips=STATE.trips.filter(t=>t.id!==id);
  saveToStorage();renderAccounts();showToast("🗑️ تم الحذف","error");
}
function renderAccounts(){
  const fv=getVal("acc-vehicle-id"),fp=getVal("acc-period");
  const now=new Date();
  let trips=STATE.trips.filter(t=>{
    if(fv&&t.vehicle!==fv)return false;
    if(fp==="month"){const d=new Date(t.date);if(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear())return false;}
    else if(fp==="year"){if(new Date(t.date).getFullYear()!==now.getFullYear())return false;}
    return true;
  });
  const sumUp=trips.reduce((s,t)=>s+(t.upSa||0),0);
  const sumDown=trips.reduce((s,t)=>s+(t.downSa||0),0);
  const sumRev=trips.reduce((s,t)=>s+(t.totalSa||0),0);
  const sumWageEg=trips.reduce((s,t)=>s+(t.wageEg||0),0);
  const sumExpSa=trips.reduce((s,t)=>s+(t.expSa||0),0);
  const sumExpEg=trips.reduce((s,t)=>s+(t.expEg||0),0);
  const sumCusSa=trips.reduce((s,t)=>s+(t.cusSa||0),0);
  const sumCusEg=trips.reduce((s,t)=>s+(t.cusEg||0),0);
  const netSa=trips.reduce((s,t)=>s+(t.netSa||0),0);
  const netEg=trips.reduce((s,t)=>s+(t.netEg||0),0);
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const sc=(id,v)=>{const e=document.getElementById(id);if(e){e.textContent=v;e.style.color=parseFloat(v)>=0?"var(--green)":"var(--red)";}};
  s("sum-up",fmtNum(sumUp)); s("cnt-up",trips.filter(t=>t.upSa>0).length+" نقلة");
  s("sum-down",fmtNum(sumDown)); s("cnt-down",trips.filter(t=>t.downSa>0).length+" نقلة");
  s("sum-revenue",fmtNum(sumRev)); s("sum-wage-eg",fmtNum(sumWageEg));
  s("sum-exp-sa",fmtNum(sumExpSa)); s("sum-exp-eg",fmtNum(sumExpEg));
  s("sum-cus-sa",fmtNum(sumCusSa)); s("sum-cus-eg",fmtNum(sumCusEg));
  sc("sum-net-sa",fmtNum(netSa)); sc("sum-net-eg",fmtNum(netEg));
  const tb=document.getElementById("accounts-tbody");
  const sorted=[...trips].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!sorted.length){tb.innerHTML=`<tr><td colspan="15" class="empty-state">لا توجد نقلات</td></tr>`;return;}
  tb.innerHTML=sorted.map((t,i)=>`<tr>
    <td>${i+1}</td>
    <td><strong>${getVehicleName(t.vehicle)}</strong> <small style="color:var(--muted)">${formatDate(t.date)}</small></td>
    <td data-label="السائق">${t.driver?getDriverName(t.driver):"—"}</td>
    <td data-label="🚀طالع(ر)" class="val-income">${t.upSa?fmtNum(t.upSa):"—"}</td>
    <td data-label="🔄نازل(ر)" class="val-income">${t.downSa?fmtNum(t.downSa):"—"}</td>
    <td data-label="أجرة(ج)" class="val-expense">${t.wageEg?fmtNum(t.wageEg):"—"}</td>
    <td data-label="مصروف(ر)" class="val-expense">${t.expSa?fmtNum(t.expSa):"—"}</td>
    <td data-label="مصروف(ج)" class="val-expense">${t.expEg?fmtNum(t.expEg):"—"}</td>
    <td data-label="عهدة(ر)" class="val-expense">${t.cusSa?fmtNum(t.cusSa):"—"}</td>
    <td data-label="عهدة(ج)" class="val-expense">${t.cusEg?fmtNum(t.cusEg):"—"}</td>
    <td data-label="صافي(ر)" class="${t.netSa>=0?"val-income":"val-expense"}">${fmtNum(t.netSa)}</td>
    <td data-label="صافي(ج)" class="${t.netEg>=0?"val-income":"val-expense"}">${fmtNum(t.netEg)}</td>
    <td data-label="ملاحظات" class="notes-cell">${t.notes||"—"}</td>
    <td>
      <button class="btn-icon" onclick="editTrip('${t.id}')">✏️</button>
      <button class="btn-icon danger" onclick="deleteTrip('${t.id}')">🗑️</button>
    </td></tr>`).join("");
}

// ===== MAINTENANCE =====
function addMaintenance(){
  const entityId=getVal("m-entity-id"),date=getVal("m-date");
  if(!entityId||!date){showToast("⚠️ يرجى ملء الحقول الإلزامية","warning");return;}
  const types=getChecked(document.getElementById("m-checkboxes"));const other=getVal("m-other");if(other)types.push(other);
  if(!types.length){showToast("⚠️ اختار نوع الصيانة على الأقل","warning");return;}
  STATE.maintenance.push({id:genId(),entityType:getVal("m-entity-type"),entityId,types,date,nextDate:getVal("m-next-date"),cost:getVal("m-cost"),center:getVal("m-center"),status:getVal("m-status")||"مكتملة",notes:getVal("m-notes")});
  saveToStorage();renderMaintenance();checkAllExpiry();updateDashboard();closeModal("modal-add-maintenance");
  document.getElementById("m-checkboxes").querySelectorAll("input[type=checkbox]").forEach(c=>c.checked=false);["m-other","m-notes","m-cost","m-center"].forEach(i=>setVal(i,""));
  showToast("✅ تم إضافة سجل الصيانة");
}
function deleteMaintenance(id){
  if(!confirm("حذف؟"))return;STATE.maintenance=STATE.maintenance.filter(m=>m.id!==id);
  saveToStorage();renderMaintenance();updateDashboard();showToast("🗑️ تم الحذف","error");
}
function getEntityName(type,id){
  if(type==="trailer"){const v=STATE.vehicles.find(x=>x.id===id);return v&&v.trailerNum?`براد ${v.trailerNum} (${v.plate})`:"براد";}
  return getVehicleName(id);
}
function renderMaintenance(){
  const tb=document.getElementById("maintenance-tbody");
  if(!STATE.maintenance.length){tb.innerHTML=`<tr><td colspan="10" class="empty-state">لا توجد سجلات صيانة</td></tr>`;return;}
  tb.innerHTML=STATE.maintenance.map((m,i)=>`<tr>
    <td>${i+1}</td>
    <td><strong>${getEntityName(m.entityType,m.entityId)}</strong> <span class="status-badge ${m.entityType==="trailer"?"s-purple":"s-info"}">${m.entityType==="trailer"?"❄️":"🚗"}</span></td>
    <td data-label="أنواع الصيانة" style="white-space:normal;display:block;padding:4px 0;font-size:.8rem;border-bottom:1px solid rgba(255,255,255,.04)">${(m.types||[]).join(" • ")||"—"}</td>
    <td data-label="التاريخ">${formatDate(m.date)}</td>
    <td data-label="التكلفة">${m.cost||"—"}</td>
    <td data-label="المركز">${m.center||"—"}</td>
    <td data-label="الحالة"><span class="status-badge ${mCls(m.status)}">${m.status}</span></td>
    <td>
      <button class="btn-icon" onclick="editMaintenance('${m.id}')">✏️ تعديل</button>
      <button class="btn-icon danger" onclick="deleteMaintenance('${m.id}')">🗑️</button>
    </td></tr>`).join("");
}

// ===== INSPECTIONS =====
function addInspection(){
  const v=getVal("ins-vehicle"),d=getVal("ins-date"),e=getVal("ins-exp");if(!v||!d||!e){showToast("⚠️ يرجى ملء الحقول الإلزامية","warning");return;}
  STATE.inspections.push({id:genId(),vehicle:v,date:d,exp:e,country:getVal("ins-country"),result:getVal("ins-result"),notes:getVal("ins-notes")});
  saveToStorage();renderInspections();checkAllExpiry();closeModal("modal-add-inspection");showToast("✅ تم إضافة سجل الفحص");
}
function editInspection(id){
  const r=STATE.inspections.find(x=>x.id===id);if(!r)return;populateVehicleSelects();
  setVal("ei-id",r.id);setVal("ei-date",r.date);setVal("ei-exp",r.exp);setVal("ei-notes",r.notes);
  document.getElementById("ei-vehicle").value=r.vehicle;document.getElementById("ei-country").value=r.country;document.getElementById("ei-result").value=r.result;
  openModal("modal-edit-inspection");
}
function saveEditInspection(){
  const id=getVal("ei-id");const i=STATE.inspections.findIndex(x=>x.id===id);if(i<0)return;
  STATE.inspections[i]={...STATE.inspections[i],vehicle:getVal("ei-vehicle"),date:getVal("ei-date"),exp:getVal("ei-exp"),country:getVal("ei-country"),result:getVal("ei-result"),notes:getVal("ei-notes")};
  saveToStorage();renderInspections();checkAllExpiry();closeModal("modal-edit-inspection");showToast("✅ تم تعديل سجل الفحص");
}
function deleteInspection(id){
  if(!confirm("حذف؟"))return;STATE.inspections=STATE.inspections.filter(r=>r.id!==id);
  saveToStorage();renderInspections();showToast("🗑️ تم الحذف","error");
}
function renderInspections(){
  const tb=document.getElementById("inspection-tbody");
  if(!STATE.inspections.length){tb.innerHTML=`<tr><td colspan="8" class="empty-state">لا توجد سجلات فحص</td></tr>`;return;}
  tb.innerHTML=STATE.inspections.map((r,i)=>{const st=expiryStatus(r.exp);return`<tr>
    <td>${i+1}</td>
    <td><strong>${getVehicleName(r.vehicle)}</strong></td>
    <td data-label="تاريخ الفحص">${formatDate(r.date)}</td>
    <td data-label="تاريخ الانتهاء">${formatDate(r.exp)}</td>
    <td data-label="الدولة">${r.country}</td>
    <td data-label="النتيجة"><span class="status-badge ${rCls(r.result)}">${r.result}</span></td>
    <td data-label="الحالة"><span class="status-badge ${st.cls}">${st.label}</span></td>
    <td><button class="btn-icon" onclick="editInspection('${r.id}')">✏️</button><button class="btn-icon danger" onclick="deleteInspection('${r.id}')">🗑️</button></td>
  </tr>`;}).join("");
}

// ===== LICENSES =====
function addLicense(){
  const entityId=getVal("lic-entity-id"),num2=getVal("lic-num"),exp=getVal("lic-exp"),issue=getVal("lic-issue");
  if(!entityId||!num2||!exp||!issue){showToast("⚠️ يرجى ملء الحقول الإلزامية","warning");return;}
  STATE.licenses.push({id:genId(),entityType:getVal("lic-entity-type"),entityId,num:num2,issue,exp,country:getVal("lic-country"),authority:getVal("lic-authority")});
  saveToStorage();renderLicenses();checkAllExpiry();closeModal("modal-add-license");showToast("✅ تم إضافة الترخيص");
}
function editLicense(id){
  const r=STATE.licenses.find(x=>x.id===id);if(!r)return;
  updateElicEntity();
  setVal("el-id",r.id);setVal("el-num",r.num);setVal("el-issue",r.issue);setVal("el-exp",r.exp);setVal("el-authority",r.authority);
  document.getElementById("el-entity-type").value=r.entityType;updateElicEntity();
  setTimeout(()=>{document.getElementById("el-entity-id").value=r.entityId;document.getElementById("el-country").value=r.country;},50);
  openModal("modal-edit-license");
}
function saveEditLicense(){
  const id=getVal("el-id");const i=STATE.licenses.findIndex(x=>x.id===id);if(i<0)return;
  STATE.licenses[i]={...STATE.licenses[i],entityType:getVal("el-entity-type"),entityId:getVal("el-entity-id"),num:getVal("el-num"),issue:getVal("el-issue"),exp:getVal("el-exp"),country:getVal("el-country"),authority:getVal("el-authority")};
  saveToStorage();renderLicenses();checkAllExpiry();closeModal("modal-edit-license");showToast("✅ تم تعديل الترخيص");
}
function deleteLicense(id){
  if(!confirm("حذف؟"))return;STATE.licenses=STATE.licenses.filter(r=>r.id!==id);
  saveToStorage();renderLicenses();showToast("🗑️ تم الحذف","error");
}
function renderLicenses(){
  const tb=document.getElementById("license-tbody");
  if(!STATE.licenses.length){tb.innerHTML=`<tr><td colspan="10" class="empty-state">لا توجد تراخيص</td></tr>`;return;}
  tb.innerHTML=STATE.licenses.map((r,i)=>{const st=expiryStatus(r.exp);return`<tr>
    <td>${i+1}</td>
    <td><strong>${getEntityName(r.entityType,r.entityId)} <span class="status-badge ${r.entityType==="trailer"?"s-purple":"s-info"}">${r.entityType==="trailer"?"❄️":"🚗"}</span></strong></td>
    <td data-label="رقم الترخيص">${r.num}</td>
    <td data-label="تاريخ الإصدار">${formatDate(r.issue)}</td>
    <td data-label="تاريخ الانتهاء">${formatDate(r.exp)}</td>
    <td data-label="الدولة">${r.country}</td>
    <td data-label="الجهة">${r.authority||"—"}</td>
    <td data-label="الحالة"><span class="status-badge ${st.cls}">${st.label}</span></td>
    <td><button class="btn-icon" onclick="editLicense('${r.id}')">✏️</button><button class="btn-icon danger" onclick="deleteLicense('${r.id}')">🗑️</button></td>
  </tr>`;}).join("");
}

// ===== INSURANCE =====
function addInsurance(){
  const v=getVal("ins2-vehicle"),c=getVal("ins2-company");
  if(!v||!c){showToast("⚠️ يرجى اختيار العربية وشركة التأمين","warning");return;}
  const modal=document.getElementById("modal-add-insurance");const countries=getChecked(modal);
  if(!countries.length){showToast("⚠️ اختار دولة واحدة على الأقل","warning");return;}
  const rec={id:genId(),vehicle:v,num:getVal("ins2-num"),company:c,type:getVal("ins2-type"),countries,
    startJO:getVal("ins2-start-jo"),expJO:getVal("ins2-exp-jo"),priceJO:getVal("ins2-price-jo"),numJO:getVal("ins2-num-jo"),
    startSA:getVal("ins2-start-sa"),expSA:getVal("ins2-exp-sa"),priceSA:getVal("ins2-price-sa"),numSA:getVal("ins2-num-sa")};
  STATE.insurance.push(rec);
  saveToStorage();renderInsurance();checkAllExpiry();closeModal("modal-add-insurance");
  modal.querySelectorAll("input[type=checkbox]").forEach(x=>x.checked=false);
  ["ins2-num","ins2-company","ins2-start-jo","ins2-exp-jo","ins2-price-jo","ins2-num-jo","ins2-start-sa","ins2-exp-sa","ins2-price-sa","ins2-num-sa"].forEach(i=>setVal(i,""));
  showToast("✅ تم إضافة وثيقة التأمين");
}
function editInsurance(id){
  const r=STATE.insurance.find(x=>x.id===id);if(!r)return;populateVehicleSelects();
  setVal("eins-id",r.id);setVal("eins-num",r.num);setVal("eins-company",r.company);
  setVal("eins-start-jo",r.startJO);setVal("eins-exp-jo",r.expJO);setVal("eins-price-jo",r.priceJO);setVal("eins-num-jo",r.numJO);
  setVal("eins-start-sa",r.startSA);setVal("eins-exp-sa",r.expSA);setVal("eins-price-sa",r.priceSA);setVal("eins-num-sa",r.numSA);
  document.getElementById("eins-vehicle").value=r.vehicle;document.getElementById("eins-type").value=r.type;
  setChecked(document.getElementById("eins-countries"),r.countries||[]);
  openModal("modal-edit-insurance");
}
function saveEditInsurance(){
  const id=getVal("eins-id");const i=STATE.insurance.findIndex(x=>x.id===id);if(i<0)return;
  const countries=getChecked(document.getElementById("eins-countries"));
  STATE.insurance[i]={...STATE.insurance[i],vehicle:getVal("eins-vehicle"),num:getVal("eins-num"),company:getVal("eins-company"),type:getVal("eins-type"),countries,
    startJO:getVal("eins-start-jo"),expJO:getVal("eins-exp-jo"),priceJO:getVal("eins-price-jo"),numJO:getVal("eins-num-jo"),
    startSA:getVal("eins-start-sa"),expSA:getVal("eins-exp-sa"),priceSA:getVal("eins-price-sa"),numSA:getVal("eins-num-sa"),
    tirNum:getVal("eins-tir-num"),tirIssue:getVal("eins-tir-issue"),tirExp:getVal("eins-tir-exp"),
    tirAuthority:getVal("eins-tir-authority"),tirSheets:getVal("eins-tir-sheets"),tirNotes:getVal("eins-tir-notes")};
  saveToStorage();renderInsurance();checkAllExpiry();closeModal("modal-edit-insurance");showToast("✅ تم تعديل وثيقة التأمين");
}
function deleteInsurance(id){
  if(!confirm("حذف؟"))return;STATE.insurance=STATE.insurance.filter(r=>r.id!==id);
  saveToStorage();renderInsurance();showToast("🗑️ تم الحذف","error");
}
function renderInsurance(){
  const tb=document.getElementById("insurance-tbody");
  if(!STATE.insurance.length){tb.innerHTML=`<tr><td colspan="12" class="empty-state">لا توجد وثائق تأمين</td></tr>`;return;}
  tb.innerHTML=STATE.insurance.map((r,i)=>{
    const stJO=r.expJO?expiryStatus(r.expJO):{label:"—",cls:""};
    const stSA=r.expSA?expiryStatus(r.expSA):{label:"—",cls:""};
    return`<tr>
      <td>${i+1}</td><td>${getVehicleName(r.vehicle)}</td>
      <td>${r.company}</td><td>${r.type}</td>
      <td style="font-size:.72rem;max-width:100px;white-space:normal">${(r.countries||[]).join(" • ")||"—"}</td>
      <td>
        <div style="font-size:.74rem">
          <div>🇯🇴 ${formatDate(r.startJO)} ← ${formatDate(r.expJO)}</div>
          <div style="margin-top:3px"><span class="status-badge ${stJO.cls}">${stJO.label}</span></div>
          ${r.priceJO?`<div style="color:var(--gold);font-weight:700;margin-top:2px">${r.priceJO} د.أ</div>`:""}
        </div>
      </td>
      <td>
        <div style="font-size:.74rem">
          <div>🇸🇦 ${formatDate(r.startSA)} ← ${formatDate(r.expSA)}</div>
          <div style="margin-top:3px"><span class="status-badge ${stSA.cls}">${stSA.label}</span></div>
          ${r.priceSA?`<div style="color:var(--gold);font-weight:700;margin-top:2px">${r.priceSA} ر.س</div>`:""}
        </div>
      </td>
      <td>
        <div style="font-size:.74rem">
          ${r.tirNum?`<div style="font-weight:700;color:var(--blue)">📄 ${r.tirNum}</div>`:"—"}
          ${r.tirExp?`<div style="margin-top:2px">${formatDate(r.tirIssue)} ← ${formatDate(r.tirExp)}</div>`:""}
          ${r.tirExp?`<div style="margin-top:2px"><span class="status-badge ${expiryStatus(r.tirExp).cls}">${expiryStatus(r.tirExp).label}</span></div>`:""}
          ${r.tirSheets?`<div style="color:var(--orange);margin-top:2px">🗂️ ${r.tirSheets} ورقة متبقية</div>`:""}
        </div>
      </td>
      <td style="display:flex;gap:5px;padding:8px 10px">
        <button class="btn-icon" onclick="editInsurance('${r.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteInsurance('${r.id}')">🗑️</button>
      </td></tr>`;
  }).join("");
}

// ===== EXPIRY CHECK =====
function checkAllExpiry(){
  const notifs=[];
  const push=(icon,title,d,type)=>{const days=daysUntil(d);if(days===null)return;const status=days<0?"expired":days<=30?"soon":"ok";const desc=days<0?`انتهى منذ ${Math.abs(days)} يوم`:days===0?"ينتهي اليوم!":`ينتهي خلال ${days} يوم`;notifs.push({type,status,days,icon,title,desc});};
  STATE.drivers.forEach(d=>push("👨‍✈️",`رخصة السائق: ${d.name}`,d.licenseExp,"driver"));
  STATE.vehicles.forEach(v=>{if(v.trailerLicExp)push("❄️",`ترخيص براد: ${v.trailerNum||""} (${v.plate})`,v.trailerLicExp,"trailer");});
  STATE.inspections.forEach(r=>push("🔍",`فحص: ${getVehicleName(r.vehicle)} (${r.country})`,r.exp,"inspection"));
  STATE.licenses.forEach(r=>push("📋",`ترخيص ${r.entityType==="trailer"?"براد":"عربية"}: ${getEntityName(r.entityType,r.entityId)} (${r.country})`,r.exp,"license"));
  STATE.insurance.forEach(r=>{
    if(r.expJO)push("🛡️",`تأمين أردني: ${getVehicleName(r.vehicle)}`,r.expJO,"insurance");
    if(r.expSA)push("🛡️",`تأمين سعودي: ${getVehicleName(r.vehicle)}`,r.expSA,"insurance");
    if(r.tirExp)push("🌍",`TIR Carnet: ${getVehicleName(r.vehicle)}`,r.tirExp,"tir");
  });
  STATE.maintenance.forEach(m=>{if(m.nextDate)push("🔧",`صيانة قادمة: ${getEntityName(m.entityType,m.entityId)}`,m.nextDate,"maintenance");});
  const order={expired:0,soon:1,ok:2};
  notifs.sort((a,b)=>(order[a.status]-order[b.status])||(a.days-b.days));
  STATE.notifications=notifs;
  const urgent=notifs.filter(n=>n.status!=="ok").length;
  document.getElementById("notif-badge").textContent=urgent;document.getElementById("bell-badge").textContent=urgent;
  document.getElementById("stat-expiring").textContent=urgent;
  const expired=notifs.filter(n=>n.status==="expired");
  if(expired.length)showAlertBar(`⚠️ تنبيه: ${expired.length} وثيقة منتهية تحتاج تجديد فوري!`);
  else closeAlertBar();
  renderNotifications(notifs);updateDashboard();
}
function renderNotifications(notifs){
  const list=document.getElementById("notif-list");
  if(!notifs.length){list.innerHTML=`<div class="empty-state">✅ كل شيء سليم</div>`;return;}
  list.innerHTML=notifs.map(n=>`<div class="notif-item ${n.status}" data-status="${n.status}"><div class="notif-icon">${n.icon}</div><div class="notif-content"><div class="notif-title">${n.title}</div><div class="notif-desc">${n.desc}</div><span class="notif-tag ${n.status}">${n.status==="expired"?"⛔ منتهي":n.status==="soon"?"⚠️ قريب الانتهاء":"✅ سليم"}</span></div></div>`).join("");
}
function filterNotifs(s,btn){document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".notif-item").forEach(item=>{item.style.display=(s==="all"||item.dataset.status===s)?"":"none";});}

// ===== DASHBOARD =====
function updateDashboard(){
  const ud=document.getElementById("urgent-alerts");const exp=STATE.notifications.filter(n=>n.status==="expired");
  ud.innerHTML=exp.length?exp.slice(0,5).map(n=>`<div class="alert-item"><div class="dot red"></div><div>${n.icon} ${n.title} — <strong>${n.desc}</strong></div></div>`).join(""):`<div class="empty-state">✅ لا توجد تنبيهات عاجلة</div>`;
  const ue=document.getElementById("upcoming-events");const soon=STATE.notifications.filter(n=>n.status==="soon").slice(0,5);
  ue.innerHTML=soon.length?soon.map(n=>`<div class="alert-item"><div class="dot orange"></div><div>${n.icon} ${n.title} — <strong>${n.desc}</strong></div></div>`).join(""):`<div class="empty-state">لا توجد مواعيد قريبة</div>`;
}

// ===== AUTO-SAVE FIX + EXPORT/IMPORT =====
// تصدير البيانات لملف JSON
function exportData(){
  const data={state:STATE,profile:JSON.parse(localStorage.getItem("fleet_profile")||"{}"),exported:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download="اسطول-الخال-"+new Date().toISOString().slice(0,10)+".json";
  a.click();URL.revokeObjectURL(url);showToast("✅ تم تصدير البيانات");
}
// استيراد البيانات من ملف JSON
function importData(){
  const input=document.createElement("input");input.type="file";input.accept=".json";
  input.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(data.state){Object.keys(data.state).forEach(k=>{if(STATE[k]!==undefined)STATE[k]=data.state[k];});}
        if(data.profile){localStorage.setItem("fleet_profile",JSON.stringify(data.profile));loadProfile();}
        saveToStorage();renderAll();checkAllExpiry();showToast("✅ تم استيراد البيانات بنجاح");
      }catch(err){showToast("❌ الملف غلط أو تالف","error");}
    };reader.readAsText(file);
  };input.click();
}

// ===== CURRENCY RATES =====
async function loadCurrencyRates(){
  try{
    const res=await fetch("https://api.exchangerate-api.com/v4/latest/EGP");
    const data=await res.json();
    if(data&&data.rates){
      const r=data.rates;
      const fmt=(code)=>r[code]?(1/r[code]).toFixed(2)+"  جنيه":"—";
      document.getElementById("rate-sar").textContent=fmt("SAR");
      document.getElementById("rate-usd").textContent=fmt("USD");
      document.getElementById("rate-eur").textContent=fmt("EUR");
      document.getElementById("rate-jod").textContent=fmt("JOD");
      const now=new Date();
      document.getElementById("currency-updated").textContent="آخر تحديث: "+now.toLocaleTimeString("ar-EG")+" — "+now.toLocaleDateString("ar-EG");
    }
  }catch(e){
    // fallback values
    const el=document.getElementById("rate-sar");if(el)el.textContent="8.60 جنيه";
    const eu=document.getElementById("rate-usd");if(eu)eu.textContent="31.50 جنيه";
    const ee=document.getElementById("rate-eur");if(ee)ee.textContent="34.20 جنيه";
    const ej=document.getElementById("rate-jod");if(ej)ej.textContent="44.50 جنيه";
    const upd=document.getElementById("currency-updated");if(upd)upd.textContent="تعذر التحديث — أسعار تقريبية";
  }
}

// ===== MOBILE NOTIFICATIONS =====
let notifPermission=false;
async function requestNotifPermission(){
  if(!("Notification" in window))return;
  if(Notification.permission==="granted"){notifPermission=true;return;}
  if(Notification.permission!=="denied"){
    const p=await Notification.requestPermission();
    notifPermission=(p==="granted");
  }
}

function sendNotif(title,body,icon="🚛"){
  if(!notifPermission||!("Notification" in window))return;
  try{new Notification(title,{body,icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><text y='32' font-size='32'>🚛</text></svg>"});}
  catch(e){}
}

function playAlertSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    osc.frequency.setValueAtTime(660,ctx.currentTime+0.15);
    osc.frequency.setValueAtTime(880,ctx.currentTime+0.3);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.5);
  }catch(e){}
}

function checkAndNotify(){
  const expired=STATE.notifications.filter(n=>n.status==="expired");
  const soon=STATE.notifications.filter(n=>n.status==="soon");
  if(expired.length>0){
    playAlertSound();
    sendNotif("⛔ وثائق منتهية!",`عندك ${expired.length} وثيقة منتهية تحتاج تجديد فوري`);
  } else if(soon.length>0){
    sendNotif("⚠️ تنبيه انتهاء قريب",`${soon.length} وثيقة ستنتهي خلال 30 يوم`);
  }
}