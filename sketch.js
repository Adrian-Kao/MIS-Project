// === Interactive vector grasshopper with rider (Map + Unlock + Scroll Story + Chest fly-in) ===

let rig;
let bgImg;
let jumpSound;

let narrationSounds = {}; // 每個景點一個音檔
let storyImages = {}; // 每個景點對應的圖片陣列（目前先預留）
let playButton = { x: 0, y: 0, w: 0, h: 0 }; // 右下角播放鍵位置


// === 故事捲動狀態 ===
let storyScroll = {
    offset: 0,
    maxOffset: 0,
    isDragging: false,
    dragStartY: 0,
    offsetStart: 0,
    barX: 0,
    barTop: 0,
    barBottom: 0,
    thumbTop: 0,
    thumbH: 0
};

// 把 txt 內容依照寬度先切好行
let wrappedStories = {}; // key: spotName + '_' + width


// === 模式：地圖 / 故事 / 過場 ===
let mode = 'map'; // 'map' | 'story' | 'transition'

// === 解鎖地名動畫 ===
let unlockAnim = {
    playing: false,
    t: 0,
    duration: 1.0,
    hold: 0.4,
    spot: null
};

// === 卷軸動畫 ===
let scrollAnim = {
    playing: false,
    t: 0,
    duration: 1.2,
    dir: 'open', // 'open' | 'close'
    spot: null
};

// === 寶箱 ===
let chest = {
    x: 0,
    y: 0,
    w: 120,
    h: 90,
    bouncing: false,
    t: 0
};

// === Map Spots（錨點 + 可點矩形區域） ===
const spots = [
    { name: "Telescope", label: "千島湖觀賞點", x: 300, y: 900, rx: 120, ry: 90, unlocked: false },
    { name: "Trees", label: "白石坡道", x: 780, y: 600, rx: 130, ry: 80, unlocked: false },
    { name: "Village", label: "失落村莊", x: 1300, y: 800, rx: 130, ry: 80, unlocked: false },
    { name: "Bridge", label: "木造樓梯", x: 1600, y: 330, rx: 120, ry: 100, unlocked: false },
    { name: "School", label: "永安國小", x: 1950, y: 180, rx: 130, ry: 80, unlocked: false },
    { name: "Shop", label: "茶行", x: 1950, y: 1000, rx: 110, ry: 70, unlocked: false },
    { name: "wall", label: "彩繪牆", x: 1065, y: 270, rx: 120, ry: 100, unlocked: false }
];

let pendingSpot = null; // 目前正要前往的景點
let justArrived = false; // 避免重複觸發到達事件

// === 故事內容（由 txt 讀入） ===
let stories = {}; // stories["Telescope"] 會是一個字串陣列（每行一段）

function preload() {
    bgImg = loadImage('map.jpg');

    jumpSound = loadSound('/sounds/hop.mp4');

    // 🔊 每個景點的口述音檔
    narrationSounds["School"] = loadSound('audio/school.m4a');
    narrationSounds["wall"] = loadSound('audio/wall.m4a');
    narrationSounds["Village"] = loadSound('audio/village.m4a');
    narrationSounds["Telescope"] = loadSound('audio/telescope.m4a');
    narrationSounds["Shop"] = loadSound('audio/shop.m4a');

    // 📝 文字故事
    stories["Telescope"] = loadStrings('stories/Telescope.txt');
    stories["Trees"] = loadStrings('stories/Trees.txt');
    stories["Village"] = loadStrings('stories/Village.txt');
    stories["Bridge"] = loadStrings('stories/Bridge.txt');
    stories["School"] = loadStrings('stories/School.txt');
    stories["Shop"] = loadStrings('stories/Shop.txt');
    stories["wall"] = loadStrings('stories/Wall.txt');
}

function setup() {
    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.parent('sketch');

    rig = new RiderBug(createVector(width * 0.2, height * 0.6));

    // 寶箱在左上角
    chest.x = 140;
    chest.y = 120;
}

// 播放 / 暫停某個景點的口述
function toggleNarration(spotName) {
    const snd = narrationSounds[spotName];
    if (!snd) return;

    if (snd.isPlaying()) {
        snd.pause();
    } else {
        snd.play();
    }
}

// 停止所有口述（關閉卷軸時用）
function stopAllNarrations() {
    for (let key in narrationSounds) {
        const snd = narrationSounds[key];
        if (snd && snd.isPlaying()) {
            snd.stop();
        }
    }
}

function draw() {
    // 背景
    if (bgImg) {
        image(bgImg, 0, 0, width, height);
    } else {
        background(160, 200, 180);
    }

    const dt = min(1 / 30, deltaTime / 1000);

    // 地圖模式才更新蚱蜢位置
    if (mode === 'map') {
        rig.update(dt);

        if (pendingSpot && !rig.isJumping && rig.altitude === 0) {
            const d = dist(rig.pos.x, rig.pos.y, pendingSpot.x, pendingSpot.y);
            if (d < 30 && !justArrived) {
                justArrived = true;
                triggerSpotUnlock(pendingSpot);
            }
        }
    }

    // 蚱蜢
    rig.draw();

    // debug：可點區域（關掉方框）
    // drawDebugRegions();

    // 解鎖字
    if (unlockAnim.playing) {
        unlockAnim.t += dt;
        let p = unlockAnim.t / unlockAnim.duration;
        p = constrain(p, 0, 1);
        drawUnlockAnimation(unlockAnim.spot, p);

        if (unlockAnim.t >= unlockAnim.duration + unlockAnim.hold) {
            unlockAnim.playing = false;
            startScrollOpen(unlockAnim.spot);
            pendingSpot = null;
            justArrived = false;
        }
    }

    // 卷軸
    if (scrollAnim.playing) {
        scrollAnim.t += dt;
        let p = scrollAnim.t / scrollAnim.duration;
        p = constrain(p, 0, 1);
        drawScrollOverlay(scrollAnim.spot, scrollAnim.dir, p);

        if (p >= 1) {
            scrollAnim.playing = false;
            if (scrollAnim.dir === 'open') {
                mode = 'story';
            } else {
                mode = 'map';
                scrollAnim.spot = null;
                pendingSpot = null;
                justArrived = false;
                // 收進寶箱 → 寶箱跳一下
                chest.bouncing = true;
                chest.t = 0;
            }
        }
    } else if (mode === 'story') {
        // 故事模式：卷軸保持全開在中央
        drawScrollOverlay(scrollAnim.spot, 'open', 1);
    }

    // 故事文字
    if (mode === 'story' || (scrollAnim.playing && scrollAnim.dir === 'open')) {
        drawStoryContent(scrollAnim.spot);
    }

    // 寶箱
    drawChest(dt);

    // HUD 只在地圖
    if (mode === 'map') drawHUD();
}

// 解鎖動畫
function triggerSpotUnlock(spot) {
    unlockAnim.playing = true;
    unlockAnim.t = 0;
    unlockAnim.spot = spot;
    spot.unlocked = true;
}

// 開啟卷軸（中央展開）
function startScrollOpen(spot) {
    scrollAnim.playing = true;
    scrollAnim.t = 0;
    scrollAnim.dir = 'open';
    scrollAnim.spot = spot;
    mode = 'transition';

    storyScroll.offset = 0;
    storyScroll.isDragging = false;
}

// 關閉卷軸（中央 → 寶箱）
function startScrollClose() {
    if (!scrollAnim.spot) return;

    // 關閉卷軸時停止所有口述
    stopAllNarrations();

    scrollAnim.playing = true;
    scrollAnim.t = 0;
    scrollAnim.dir = 'close';
    mode = 'transition';
}

// 滑鼠
function mousePressed() {
    // 故事模式：先檢查播放鍵，再檢查捲動條
    if (mode === 'story') {
        // ▶ 播放按鈕點擊
        if (playButton.w > 0) {
            if (
                mouseX >= playButton.x && mouseX <= playButton.x + playButton.w &&
                mouseY >= playButton.y && mouseY <= playButton.y + playButton.h
            ) {
                if (scrollAnim.spot) {
                    toggleNarration(scrollAnim.spot.name);
                }
                return false;
            }
        }

        // ⬇️ 捲動條拖曳
        if (storyScroll.maxOffset > 0 && storyScroll.thumbH > 0) {
            const x = mouseX;
            const y = mouseY;
            const barX = storyScroll.barX;
            const thumbTop = storyScroll.thumbTop;
            const thumbBottom = storyScroll.thumbTop + storyScroll.thumbH;
            const barWidth = 16; // 點擊範圍

            if (abs(x - barX) <= barWidth && y >= thumbTop && y <= thumbBottom) {
                storyScroll.isDragging = true;
                storyScroll.dragStartY = mouseY;
                storyScroll.offsetStart = storyScroll.offset;
                return false;
            }
        }
        return false;
    }

    // 原本地圖模式邏輯
    if (mode !== 'map') return;
    selectSpot(mouseX, mouseY);
}

function mouseDragged() {
    if (mode === 'story') {
        if (storyScroll.isDragging && storyScroll.maxOffset > 0) {
            const barH = storyScroll.barBottom - storyScroll.barTop;
            const movableH = barH - storyScroll.thumbH;
            if (movableH > 0) {
                const dy = mouseY - storyScroll.dragStartY;
                const ratio = dy / movableH;
                storyScroll.offset = constrain(
                    storyScroll.offsetStart + ratio * storyScroll.maxOffset,
                    0,
                    storyScroll.maxOffset
                );
            }
        }
        return false;
    }

    if (mode !== 'map') return;
    rig.setTarget(mouseX, mouseY);
}

function mouseReleased() {
    storyScroll.isDragging = false;
}

function mouseWheel(event) {
    if (mode === 'story') {
        // 滾輪往下 event.delta > 0 → offset 增加，往下看
        storyScroll.offset = constrain(
            storyScroll.offset + event.delta,
            0,
            storyScroll.maxOffset
        );
        return false; // 阻止畫面跟著捲動
    }
}

function touchStarted() {
    if (mode !== 'map') return false;
    rig.setTarget(mouseX, mouseY);
    return false;
}

// 選景點（矩形）
function selectSpot(mx, my) {
    let closest = null;
    let bestDist = 99999;

    for (let sp of spots) {
        const inX = mx >= sp.x - sp.rx && mx <= sp.x + sp.rx;
        const inY = my >= sp.y - sp.ry && my <= sp.y + sp.ry;
        if (inX && inY) {
            const d = dist(mx, my, sp.x, sp.y);
            if (d < bestDist) {
                bestDist = d;
                closest = sp;
            }
        }
    }

    if (closest) {
        pendingSpot = closest;
        rig.setTarget(closest.x, closest.y);
        justArrived = false;
    }
}

// 鍵盤
function keyReleased() {
    if (keyCode === LEFT_ARROW) rig.move.left = false;
    if (keyCode === RIGHT_ARROW) rig.move.right = false;
    if (keyCode === UP_ARROW) rig.move.up = false;
    if (keyCode === DOWN_ARROW) rig.move.down = false;
}

function keyPressed() {
    // 故事模式：B 收進寶箱
    if (mode === 'story' && (key === 'b' || key === 'B')) {
        startScrollClose();
        return;
    }
    if (mode === 'map') {
        if (keyCode === LEFT_ARROW) rig.move.left = true;
        if (keyCode === RIGHT_ARROW) rig.move.right = true;
        if (keyCode === UP_ARROW) rig.move.up = true;
        if (keyCode === DOWN_ARROW) rig.move.down = true;
    }
    if (key === '[') rig.speed = max(40, rig.speed - 20);
    if (key === ']') rig.speed = min(800, rig.speed + 20);
    if (key === 'H' || key === 'h') rig.hopOn = !rig.hopOn;
    if (key === 'G' || key === 'g') rig.cycleGait();
}

// === RiderBug 類別（不顛倒，只左右翻＋微傾斜） ===
class RiderBug {
    constructor(p) {
        this.pos = p.copy();
        this.target = p.copy();
        this.speed = 800;
        this.boost = 1.6;
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

        this.facing = 1; // 左右
        this.pitch = 0; // 上下微傾

        this.isJumping = false;
        this.jumpVelY = 0;
        this.gravity = 1500;
        this.jumpPower = 700;
        this.altitude = 0;
        this.jumpCooldown = 0.5;
        this.cooldownTimer = 0;

        this.move = { left: false, right: false, up: false, down: false };
    }

    cycleGait() { this.gaitIndex = (this.gaitIndex + 1) % this.gaitStyles.length; }

    setTarget(x, y) {
        const pad = this.size * 0.35;
        this.target.set(constrain(x, pad, width - pad), constrain(y, pad, height - pad));
    }

    update(dt) {
        let step = 0;
        let dir = createVector(0, 0);
        const hasKeyMove = this.move.left || this.move.right || this.move.up || this.move.down;

        if (hasKeyMove) {
            dir.x = (this.move.right ? 1 : 0) - (this.move.left ? 1 : 0);
            dir.y = (this.move.down ? 1 : 0) - (this.move.up ? 1 : 0);
            if (dir.magSq() > 0) {
                dir.normalize();
                const spd = this.speed * (mouseIsPressed ? this.boost : 1);
                step = spd * dt;
            }
        } else {
            const toT = p5.Vector.sub(this.target, this.pos);
            const distLeft = toT.mag();
            if (distLeft > 0.1) {
                dir = toT.mult(1 / distLeft);
                const spd = this.speed * (mouseIsPressed ? this.boost : 1);
                step = min(spd * dt, distLeft);
            }
        }

        if (step > 0) {
            this.pos.add(
                dir.x * step * (this.isJumping ? 0.8 : 1),
                dir.y * step * (this.isJumping ? 0.8 : 1)
            );

            if (abs(dir.x) > 0.01) this.facing = dir.x >= 0 ? 1 : -1;
            const horiz = max(0.001, abs(dir.x));
            const rawPitch = Math.atan2(dir.y, horiz);
            this.pitch = constrain(rawPitch, -PI / 6, PI / 6);

            const freq = this.currentGait().freq;
            this.phase += freq * (step / max(1, this.size * 0.6));
        }

        if (!this.isJumping) {
            if (step > 0.001 && this.cooldownTimer <= 0) {
                this.isJumping = true;
                this.jumpVelY = -this.jumpPower;
                this.cooldownTimer = this.jumpCooldown;

                if (jumpSound) {
                    jumpSound.stop();
                    jumpSound.play();
                }
            }
        } else {
            this.jumpVelY += this.gravity * dt;
            this.altitude += this.jumpVelY * dt;

            if (this.altitude >= 0) {
                this.altitude = 0;
                this.jumpVelY = 0;
                this.isJumping = false;
                this.phase += 0.5;
            }
        }
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    }

    currentGait() { return this.gaitStyles[this.gaitIndex]; }

    draw() {
        push();
        translate(this.pos.x, this.pos.y + this.altitude);
        scale(this.facing, 1);
        rotate(this.pitch);

        const bob = (this.hopOn && !this.isJumping) ? Math.sin(this.phase * TAU) * this.hopAmp : 0;
        translate(0, bob);

        this.drawBugVector();
        this.drawRiderVector();
        pop();
    }

    drawBugVector() {
        const s = this.size;
        noStroke();
        fill(64, 156, 94);
        ellipse(-s * 0.1, 0, s * 1.1, s * 0.38);
        ellipse(s * 0.42, -s * 0.06, s * 0.32, s * 0.26);
        fill(25);
        circle(s * 0.54, -s * 0.08, s * 0.04);

        stroke(48, 120, 72);
        strokeWeight(2);
        const antWob = 0.15 * Math.sin(this.phase * TAU);
        line(s * 0.56, -s * 0.12, s * 0.92, -s * (0.28 + antWob));
        line(s * 0.56, -s * 0.10, s * 0.95, -s * (0.16 - antWob));

        const legs = this.currentGait().offsets;
        const baseY = s * 0.12;
        stroke(48, 120, 72);
        strokeWeight(4);

        let legExtend = 1.0;
        let phaseMod = 1.0;
        if (this.isJumping) {
            legExtend = 0.9;
            phaseMod = 0.1;
        }

        for (let i = 0; i < 4; i++) {
            const side = (i % 2 === 0) ? 1 : -1;
            const xBase = [-0.28, -0.05, 0.12, 0.32][i] * s;
            const phase = this.phase + legs[i];
            const lift = 0.22 * Math.sin(phase * TAU) * phaseMod;
            const step = 0.18 * Math.cos(phase * TAU) * phaseMod;
            const footY = baseY + s * 0.30 * side * legExtend;

            const knee = createVector(
                xBase + step * s * 0.4,
                baseY + lift * s * 0.15 * side
            );
            const foot = createVector(
                xBase + step * s * 0.9,
                footY
            );
            line(xBase, baseY, knee.x, knee.y);
            line(knee.x, knee.y, foot.x, foot.y);
        }
    }

    drawRiderVector() {
        const s = this.size;
        push();
        translate(s * 0.02, -s * 0.20);
        noStroke();
        fill(56, 124, 220);
        rectMode(CENTER);
        rect(0, -s * 0.02, s * 0.22, s * 0.22, 6);
        fill(246, 208, 168);
        circle(0, -s * 0.18, s * 0.16);
        stroke(40, 90, 160);
        strokeWeight(4);
        line(-s * 0.06, s * 0.06, -s * 0.14, s * 0.14);
        line(s * 0.06, s * 0.06, s * 0.14, s * 0.14);
        stroke(220);
        strokeWeight(2);
        line(-s * 0.06, -s * 0.04, s * 0.36, -s * 0.08);
        line(s * 0.06, -s * 0.04, s * 0.36, -s * 0.06);
        pop();
    }
}

// HUD
function drawHUD() {
    const g = rig.currentGait();
    push();
    noStroke();
    fill(0, 100);
    rect(10, 10, 320, 90, 8);
    fill(220);
    textSize(12);
    text(`speed: ${rig.speed.toFixed(0)} px/s  (hold mouse = x${rig.boost})`, 20, 30);
    text(`gait: ${g.name}  |  hop: ${rig.hopOn ? 'on' : 'off'}`, 20, 50);
    text(`status: ${rig.isJumping ? 'JUMPING!' : 'Ground'} | Alt: ${(-rig.altitude).toFixed(0)} px`, 20, 70);
    text(`Arrow keys to move`, 20, 86);
    pop();
}

// 解鎖字動畫
function drawUnlockAnimation(spot, p) {
    if (!spot) return;
    let scaleV = easeOutBack(min(p * 1.2, 1));
    let alpha = constrain(p * 2, 0, 1) * 255;
    push();
    translate(spot.x, spot.y - 80);
    scale(scaleV);
    textAlign(CENTER, CENTER);
    textSize(40);
    fill(255, alpha);
    stroke(0, alpha);
    strokeWeight(4);
    text(spot.label, 0, 0);
    pop();
}

// 卷軸：open = 中央展開；close = 中央 → 寶箱
function drawScrollOverlay(spot, dir, p) {
    if (!spot) return;

    // openProgress：0->1 代表卷軸展開程度
    let openProgress;
    if (dir === 'open') {
        openProgress = easeInOutCubic(p);
    } else {
        openProgress = 1 - easeInOutCubic(p); // close 從 1 退到 0
    }

    // 暗幕
    let overlayAlpha = dir === 'open' ? openProgress : (1 - p);
    push();
    noStroke();
    fill(0, 150 * overlayAlpha);
    rect(0, 0, width, height);
    pop();

    // 卷軸尺寸 / 位置
    const margin = 80;
    const fullW = width - margin * 2;
    const fullH = height - margin * 2;
    const minW = 160;
    const minH = 100;

    let w, h, cx, cy;

    if (dir === 'open') {
        // 中央由小到大展開
        w = fullW;
        h = max(40, fullH * openProgress);
        cx = width / 2;
        cy = height / 2;
    } else {
        // 從中央縮小＋飛到寶箱
        const shrink = 1 - openProgress; // 0 → 1
        w = lerp(fullW, minW, shrink);
        h = lerp(fullH, minH, shrink);
        cx = lerp(width / 2, chest.x, shrink);
        cy = lerp(height / 2, chest.y, shrink);
    }

    push();
    rectMode(CENTER);
    // 紙
    fill(245, 230, 200);
    stroke(180, 140, 90);
    strokeWeight(4);
    rect(cx, cy, w, h, 24);
    // 邊
    const edgeH = 18;
    fill(230, 210, 180);
    noStroke();
    rect(cx, cy - h / 2 + edgeH / 2, w, edgeH, 16);
    rect(cx, cy + h / 2 - edgeH / 2, w, edgeH, 16);
    pop();
}

function getWrappedLines(spotName, maxWidth) {
    const raw = stories[spotName];
    if (!raw) return [];

    const key = spotName + '_' + int(maxWidth);
    if (wrappedStories[key]) return wrappedStories[key];

    let result = [];
    textSize(24); // 要跟 drawStoryContent 的內文字體一致

    for (let paragraph of raw) {
        let current = '';
        for (let i = 0; i < paragraph.length; i++) {
            const ch = paragraph[i];
            const next = current + ch;
            if (textWidth(next) > maxWidth && current.length > 0) {
                result.push(current);
                current = ch;
            } else {
                current = next;
            }
        }
        if (current.length > 0) result.push(current);
        // 如果想在段落之間空一行，可以：
        // result.push('');
    }

    wrappedStories[key] = result;
    return result;
}


// 卷軸中的故事
function drawStoryContent(spot) {
    if (!spot) return;

    // 文字內容：先依寬度切好行
    const margin = 80;
    const fullW = width - margin * 2;
    const fullH = height - margin * 2;
    const cx = width / 2;
    const cy = height / 2;

    const titleY = cy - fullH / 2 + 60;

    const textPaddingX = 80;
    const textStartY = titleY + 60; // 內文開始的 Y
    const textBottomY = cy + fullH / 2 - 80; // 內文可見區的底部
    const textLeft = cx - fullW / 2 + textPaddingX;
    const textRight = cx + fullW / 2 - textPaddingX;
    const textBoxW = textRight - textLeft;

    const lineH = 32;

    // 這裡會用到 textWidth，所以先設定字型
    push();
    textSize(24);
    const wrappedLines = getWrappedLines(spot.name, textBoxW);
    pop();

    if (!wrappedLines || !wrappedLines.length) return;

    const viewHeight = textBottomY - textStartY;
    const totalHeight = wrappedLines.length * lineH;

    storyScroll.maxOffset = max(0, totalHeight - viewHeight);
    storyScroll.offset = constrain(storyScroll.offset, 0, storyScroll.maxOffset);

    let alpha = 255;
    if (scrollAnim.playing && scrollAnim.dir === 'open') {
        let p = scrollAnim.t / scrollAnim.duration;
        alpha = constrain((p - 0.2) * 1.5, 0, 1) * 255;
    }

    // ===== 畫標題 + 內文 =====
    push();
    noStroke();
    fill(80, alpha);

    // 標題
    textAlign(CENTER, TOP);
    textSize(42);
    text(spot.label, cx, titleY);

    // 內文：靠左、在 textLeft ~ textRight 之間
    textAlign(LEFT, TOP);
    textSize(24);

    let y = textStartY - storyScroll.offset;
    for (let line of wrappedLines) {
        // 超出上方：略過
        if (y + lineH < textStartY) {
            y += lineH;
            continue;
        }
        // 超出下方：停止
        if (y > textBottomY) break;

        text(line, textLeft, y);
        y += lineH;
    }

    // 底部提示
    textAlign(LEFT, TOP);
    textSize(18);
    text("Press B to go back", textLeft, textBottomY + 30);
    pop();

    // ===== 右下角播放按鈕（在卷軸裡面）=====
    const btnSize = 56;
    const btnMargin = 40;

    // 卷軸本身的右下角
    const scrollRight = cx + fullW / 2;
    const scrollBottom = cy + fullH / 2;

    playButton.w = btnSize;
    playButton.h = btnSize;
    playButton.x = scrollRight - btnMargin - btnSize;
    playButton.y = scrollBottom - btnMargin - btnSize;

    // 判斷這個景點的音檔是否正在播放
    let isPlaying = false;
    const snd = narrationSounds[spot.name];
    if (snd && snd.isPlaying()) {
        isPlaying = true;
    }

    push();
    noStroke();

    // 外圈陰影
    fill(0, 60 * (alpha / 255.0));
    ellipse(
        playButton.x + btnSize / 2,
        playButton.y + btnSize / 2 + 3,
        btnSize + 6,
        btnSize + 6
    );

    // 按鈕底色（外圈）
    fill(210, 170, 110, alpha); // 暗一點的金棕色
    ellipse(
        playButton.x + btnSize / 2,
        playButton.y + btnSize / 2,
        btnSize,
        btnSize
    );

    // 內圈
    fill(245, 220, 170, alpha); // 亮一點的紙感顏色
    ellipse(
        playButton.x + btnSize / 2,
        playButton.y + btnSize / 2,
        btnSize - 10,
        btnSize - 10
    );

    // 圖示（播放 or 暫停）
    fill(80, alpha);
    const cxIcon = playButton.x + btnSize / 2;
    const cyIcon = playButton.y + btnSize / 2;

    if (!isPlaying) {
        // ▶ 播放三角形
        const r = 10;
        triangle(
            cxIcon - r * 0.5, cyIcon - r,
            cxIcon - r * 0.5, cyIcon + r,
            cxIcon + r, cyIcon
        );
    } else {
        // ⏸ 暫停圖示
        const barW = 4;
        const barH = 16;
        rectMode(CENTER);
        rect(cxIcon - 5, cyIcon, barW, barH, 2);
        rect(cxIcon + 5, cyIcon, barW, barH, 2);
    }

    // 小字：聽故事
    textAlign(RIGHT, TOP);
    textSize(14);
    fill(80, alpha);
    text("聽故事", playButton.x + btnSize - 4, playButton.y - 4);
    pop();

    // ===== 畫捲動條 =====
    if (storyScroll.maxOffset > 1) {
        const barX = textRight + 20; // 在文字區右邊
        const barTop = textStartY;
        const barBottom = textBottomY;
        const barH = barBottom - barTop;

        const thumbH = max(40, barH * (viewHeight / totalHeight));
        const t = storyScroll.maxOffset === 0 ? 0 : storyScroll.offset / storyScroll.maxOffset;
        const thumbTop = barTop + (barH - thumbH) * t;

        // 存起來給滑鼠拖曳用
        storyScroll.barX = barX;
        storyScroll.barTop = barTop;
        storyScroll.barBottom = barBottom;
        storyScroll.thumbTop = thumbTop;
        storyScroll.thumbH = thumbH;

        push();
        rectMode(CENTER);
        noStroke();

        // 背景軌道
        fill(0, 40);
        const barW = 8;
        rect(barX, (barTop + barBottom) / 2, barW, barH, 4);

        // 滑塊
        fill(120, 100);
        rect(barX, thumbTop + thumbH / 2, barW + 4, thumbH, 4);
        pop();
    } else {
        // 沒有捲動時，避免誤點
        storyScroll.barX = 0;
        storyScroll.barTop = 0;
        storyScroll.barBottom = 0;
        storyScroll.thumbTop = 0;
        storyScroll.thumbH = 0;
    }
}

// 寶箱
function drawChest(dt) {
    let lift = 0;
    let s = 1;
    if (chest.bouncing) {
        const duration = 0.4;
        chest.t += dt;
        let p = chest.t / duration;
        if (p >= 1) {
            chest.bouncing = false;
            chest.t = 0;
            p = 1;
        }
        const wave = sin(p * PI);
        lift = -12 * wave;
        s = 1 + 0.15 * wave;
    }

    push();
    translate(chest.x, chest.y + lift);
    scale(s);
    rectMode(CENTER);
    // 底座
    fill(150, 100, 60);
    stroke(90, 60, 40);
    strokeWeight(3);
    rect(0, 15, chest.w, chest.h, 10);
    // 上蓋
    fill(180, 130, 80);
    rect(0, -10, chest.w * 0.9, chest.h * 0.5, 12);
    // 鎖
    fill(240, 210, 120);
    rect(0, 10, 18, 26, 4);
    fill(150, 110, 70);
    ellipse(0, 10, 8, 8);
    pop();
}

// 緩動
function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x :
        1 - Math.pow(-2 * x + 2, 3) / 2;
}

// debug：可點區域
function drawDebugRegions() {
    push();
    noFill();
    stroke(0, 80);
    strokeWeight(2);
    rectMode(CENTER);
    for (let sp of spots) {
        rect(sp.x, sp.y, sp.rx * 2, sp.ry * 2);
    }
    pop();
}
