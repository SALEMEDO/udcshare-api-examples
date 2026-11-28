(function(){
  var root=document.documentElement,modes=["auto","light","dark"],labels={auto:"Auto",light:"Clair",dark:"Sombre"};
  var media=window.matchMedia("(prefers-color-scheme: dark)"),current="auto";
  try{var saved=localStorage.getItem("novatech-theme");if(modes.indexOf(saved)>=0)current=saved;}catch(e){}
  function apply(){
    var dark=current==="dark"||(current==="auto"&&media.matches);
    root.dataset.theme=dark?"dark":"light";root.dataset.themeMode=current;
    var meta=document.getElementById("theme-color-meta");if(meta)meta.content=dark?"#050b0a":"#f5faf7";
    var b=document.querySelector("[data-theme-toggle]");
    if(b){b.textContent=labels[current];b.setAttribute("aria-label","Thème : "+labels[current]+". Changer le thème");b.title="Thème : "+labels[current];}
  }
  apply();
  document.addEventListener("DOMContentLoaded",function(){
    apply();
    var b=document.querySelector("[data-theme-toggle]");
    if(b)b.addEventListener("click",function(){current=modes[(modes.indexOf(current)+1)%3];try{localStorage.setItem("novatech-theme",current)}catch(e){}apply();});
  });
  if(media.addEventListener)media.addEventListener("change",apply);
})();
