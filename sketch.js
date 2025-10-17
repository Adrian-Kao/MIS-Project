
    // === Interactive vector grasshopper with rider (no images, no path, no spring) ===

    let rig;
    let bgImg;
  
  
    function preload() {
    bgImg = loadImage('background.jpg');
    }
    function setup() {
      const cnv = createCanvas(windowWidth, windowHeight); // wide canvas
      cnv.parent('sketch');
      rig = new RiderBug(createVector(width*0.2, height*0.6));
    }

    function draw() {
      background(17);
    if (bgImg) {
      image(bgImg, 0, 0, width, height); // 把圖片鋪滿整個畫布
    }
      const dt = min(1/30, deltaTime / 1000);
      rig.update(dt);
      rig.draw();
      drawHUD();
    }

    function mousePressed() { rig.setTarget(mouseX, mouseY); }
    function mouseDragged() { rig.setTarget(mouseX, mouseY); }
    function touchStarted() { rig.setTarget(mouseX, mouseY); return false; }

    function keyPressed() {
      if (key === '[') rig.speed = max(40, rig.speed - 20);
      if (key === ']') rig.speed = min(800, rig.speed + 20);
      if (key === 'H' || key === 'h') rig.hopOn = !rig.hopOn;
      if (key === 'G' || key === 'g') rig.cycleGait();
    }

    class RiderBug {
      constructor(p){
        this.pos = p.copy();
        this.target = p.copy();
        this.speed = 600;
        this.boost = 1.6;
        this.angle = 0;
        this.size = 120;
        this.hopOn = true;
        this.hopAmp = 6;
        this.gaitIndex = 0;
        this.gaitStyles = [
          { name: 'walk', freq: 2.0, offsets: [0, 0.5, 0.25, 0.75] },
          { name: 'trot', freq: 3.2, offsets: [0, 0.5, 0.5, 0] },
          { name: 'bound', freq: 4.6, offsets: [0, 0, 0.5, 0.5] },
        ];
        this.phase = 0;
      }

      cycleGait(){ this.gaitIndex = (this.gaitIndex + 1) % this.gaitStyles.length; }

      setTarget(x, y){
        const pad = this.size*0.35;
        this.target.set(constrain(x, pad, width-pad), constrain(y, pad, height-pad));
      }

      update(dt){
        const toT = p5.Vector.sub(this.target, this.pos);
        const distLeft = toT.mag();
        if (distLeft > 0.1){
          const dir = toT.mult(1/distLeft);
          const spd = this.speed * (mouseIsPressed ? this.boost : 1);
          const step = min(spd * dt, distLeft);
          this.pos.add(dir.x*step, dir.y*step);
          this.angle = Math.atan2(dir.y, dir.x);
          const freq = this.currentGait().freq;
          this.phase += freq * (step / max(1, this.size*0.6));
        }
      }

      currentGait(){ return this.gaitStyles[this.gaitIndex]; }

      draw(){
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.angle);
        const bob = this.hopOn ? Math.sin(this.phase*TAU) * this.hopAmp : 0;
        translate(0, bob);
        this.drawBugVector();
        this.drawRiderVector();
        pop();
      }

      drawBugVector(){
        const s = this.size;
        noStroke();
        fill(64, 156, 94);
        ellipse(-s*0.1, 0, s*1.1, s*0.38);
        ellipse(s*0.42, -s*0.06, s*0.32, s*0.26);
        fill(25); circle(s*0.54, -s*0.08, s*0.04);
        stroke(48, 120, 72); strokeWeight(2);
        const antWob = 0.15 * Math.sin(this.phase*TAU);
        line(s*0.56, -s*0.12, s*0.92, -s*(0.28 + antWob));
        line(s*0.56, -s*0.10, s*0.95, -s*(0.16 - antWob));
        const legs = this.currentGait().offsets;
        const L = s*0.48;
        const baseY = s*0.12;
        stroke(48, 120, 72); strokeWeight(4);
        for (let i=0;i<4;i++){
          const side = (i%2===0)? 1 : -1;
          const xBase = [-0.28, -0.05, 0.12, 0.32][i] * s;
          const phase = this.phase + legs[i];
          const lift = 0.22 * Math.sin(phase*TAU);
          const step = 0.18 * Math.cos(phase*TAU);
          const knee = createVector(xBase + step*s*0.4, baseY + lift*s*0.15 * side);
          const foot = createVector(xBase + step*s*0.9, baseY + s*0.28 * side);
          line(xBase, baseY, knee.x, knee.y);
          line(knee.x, knee.y, foot.x, foot.y);
        }
      }

      drawRiderVector(){
        const s = this.size;
        push();
        translate(s*0.02, -s*0.20);
        noStroke(); fill(56, 124, 220); rectMode(CENTER); rect(0, -s*0.02, s*0.22, s*0.22, 6);
        fill(246, 208, 168); circle(0, -s*0.18, s*0.16);
        stroke(40, 90, 160); strokeWeight(4);
        line(-s*0.06, s*0.06, -s*0.14, s*0.14);
        line( s*0.06, s*0.06,  s*0.14, s*0.14);
        stroke(220); strokeWeight(2);
        line(-s*0.06, -s*0.04, s*0.36, -s*0.08);
        line( s*0.06, -s*0.04, s*0.36, -s*0.06);
        pop();
      }
    }

    function drawHUD(){
      const g = rig.currentGait();
      push();
      noStroke();
      fill(0, 100); rect(10, 10, 260, 60, 8);
      fill(220); textSize(12);
      text(`speed: ${rig.speed.toFixed(0)} px/s  (hold mouse = x${rig.boost})`, 20, 30);
      text(`gait: ${g.name}  |  hop: ${rig.hopOn ? 'on' : 'off'}`, 20, 50);
      pop();
    }

