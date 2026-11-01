// 설정 시트: 그래픽 품질, 닉네임 다시 뽑기, 아바타 색·머리 모양, 모션 줄이기, NPC 독자, 키보드 이동.
// 바꾸는 즉시 localStorage에 저장하고 앱에 알린다.
import type { QualityLevel } from '../core/params';
import { HAIR_STYLES, OUTFIT_COLORS, saveProfile, saveSettings, type Profile, type Settings } from '../core/storage';
import type { HairStyle } from '../net/presence';
import { randomNickname } from '../net/nickname';
import { Sheet } from './sheet';

const QUALITY_LABEL: Record<Settings['quality'], string> = { auto: '자동', low: '낮음', medium: '보통', high: '높음' };
const HAIR_LABEL: Record<HairStyle, string> = { bangs: '앞머리', bob: '단발', short: '짧은 머리' };

export interface SettingsHandlers {
  quality(q: QualityLevel | 'auto'): void;
  profile(p: Profile): void;
  reducedMotion(v: boolean): void;
  npc(v: boolean): void;
  keyboardMove(v: boolean): void;
}

export class SettingsSheet {
  readonly sheet = new Sheet('설정', 'settings');

  constructor(private settings: Settings, private profile: Profile, private h: SettingsHandlers, autoLevel: QualityLevel) {
    const b = this.sheet.body;
    b.innerHTML = `
      <fieldset class="field">
        <legend>그래픽 품질</legend>
        <div class="seg" role="radiogroup" aria-label="그래픽 품질">
          ${(['auto', 'low', 'medium', 'high'] as const).map((k) => `<button type="button" role="radio" data-q="${k}" aria-checked="false">${QUALITY_LABEL[k]}${k === 'auto' ? `<small>(${QUALITY_LABEL[autoLevel]})</small>` : ''}</button>`).join('')}
        </div>
      </fieldset>
      <div class="field field-row">
        <div><div class="field-label">닉네임</div><div class="nick" aria-live="polite"></div></div>
        <button type="button" class="btn" data-act="reroll" aria-label="닉네임 다시 뽑기">다시 뽑기</button>
      </div>
      <fieldset class="field">
        <legend>아바타 색</legend>
        <div class="swatches" role="radiogroup" aria-label="아바타 색">
          ${OUTFIT_COLORS.map((c, i) => `<button type="button" role="radio" class="swatch" data-color="${c}" style="--c:${c}" aria-label="색 ${i + 1}" aria-checked="false"></button>`).join('')}
        </div>
      </fieldset>
      <fieldset class="field">
        <legend>머리 모양</legend>
        <div class="seg" role="radiogroup" aria-label="머리 모양">
          ${HAIR_STYLES.map((hs) => `<button type="button" role="radio" data-hair="${hs}" aria-checked="false">${HAIR_LABEL[hs]}</button>`).join('')}
        </div>
      </fieldset>
      <label class="field field-row toggle"><span>모션 줄이기</span><input type="checkbox" data-set="reducedMotion" /></label>
      <label class="field field-row toggle"><span>NPC 독자 표시</span><input type="checkbox" data-set="npc" /></label>
      <label class="field field-row toggle"><span>키보드로 걷기 (WASD·방향키)</span><input type="checkbox" data-set="keyboardMove" /></label>
      <p class="field-note">설정은 이 브라우저에만 저장돼요.</p>`;

    b.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.settings.quality = btn.dataset.q as Settings['quality'];
        saveSettings(this.settings);
        this.render();
        this.h.quality(this.settings.quality);
      }),
    );
    b.querySelector('[data-act="reroll"]')!.addEventListener('click', () => {
      this.profile.nickname = randomNickname();
      this.commitProfile();
    });
    b.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.profile.color = btn.dataset.color!;
        this.commitProfile();
      }),
    );
    b.querySelectorAll<HTMLButtonElement>('[data-hair]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.profile.hair = btn.dataset.hair as HairStyle;
        this.commitProfile();
      }),
    );
    b.querySelectorAll<HTMLInputElement>('[data-set]').forEach((input) =>
      input.addEventListener('change', () => {
        const key = input.dataset.set as 'reducedMotion' | 'npc' | 'keyboardMove';
        this.settings[key] = input.checked;
        saveSettings(this.settings);
        this.h[key](input.checked);
      }),
    );
    this.render();
  }

  /** 다른 탭과 닉네임이 겹쳐 바뀐 경우 등 바깥에서 프로필이 바뀌었을 때 */
  setProfile(p: Profile): void {
    this.profile = p;
    this.render();
  }

  open(): void {
    this.render();
    this.sheet.open();
  }

  private commitProfile(): void {
    saveProfile(this.profile);
    this.render();
    this.h.profile({ ...this.profile });
  }

  private render(): void {
    const b = this.sheet.body;
    b.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.q === this.settings.quality)));
    b.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.color === this.profile.color)));
    b.querySelectorAll<HTMLButtonElement>('[data-hair]').forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.hair === this.profile.hair)));
    b.querySelector('.nick')!.textContent = this.profile.nickname;
    b.querySelectorAll<HTMLInputElement>('[data-set]').forEach((i) => (i.checked = this.settings[i.dataset.set as 'npc']));
  }
}
