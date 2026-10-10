# SMFアニメーションの習作

demo https://novogrammer.github.io/smf-animation-study/

## 背景

かつてはブラウザやプラグインでMIDIファイル（SMF）を直接再生できる環境もあったが、現在の一般的なブラウザにはSMFを再生する標準機能がない。そのため、この習作ではJavaScriptライブラリとサウンドフォントを使用し、Web Audio経由で再生している。

ライブラリからNote On／Note OffやMarkerなどのイベントと、そのタイミングを取得できるため、SMFの再生時間に同期した演出を試しやすい。音楽と演出で同じ時間軸を使い、演出タイミングをJavaScript側へ秒数で重複定義せずに済む利点を確かめることを、この習作の目的としている。

## 使用したMIDIファイルについて

- [Timeless Truths Libraryで公開されている「When the Saints Go Marching In」のMIDIファイル（SMF）](https://library.timelesstruths.org/music/When_the_Saints_Go_Marching_In/midi/)をダウンロードし、編集して使用した。
- 演出と検証のため、ドラムパートを追加した。
- ダウンロードしたMIDIファイルに重複Noteが見つかったため、該当箇所を修正した。

## ビジュアライザーについて

- MIDIのNote On／Note OffをもとにADSRエンベロープを計算し、Cubeのスケール変化として表現した。
- Note Onのvelocityをスケールへ反映し、音の強弱がCubeの大きさに表れるようにした。
- ADSRとカメラ位置は同じ再生時計を使う。音声あり版ではSequencerの`currentHighResolutionTime`を使い、音声なし版では`performance.now()`を基準に曲内時刻を進める。Noteの開始・終了時刻は再生元から通知する。
- MIDI状態は仕様上の16チャンネル×128ノートを保持し、内部表記のChannel 0・1・9（一般表記のChannel 1・2・10）だけにチャンネル別の`InstancedMesh`を作成した。状態管理と描画対象を分離することで、表示チャンネルを変更しやすくしている。

## Markerとカメラワークについて

- MIDIファイルに`section:intro`、`section:call`、`section:response`、`section:march`、`section:finale`というMarkerを設定し、曲の構成とカメラ演出を同期させた。
- Marker間の時間をセクションの長さとして扱い、プレイヤーの再生時間からカメラ位置を計算している。
- `section:finale`から`LoopEnd`までの間にIntroの開始位置へ戻し、ループ境界でカメラ位置が飛ばないようにした。

## Web Audioについて

- 描画側は`PlaybackClock`の再生時刻と`PlaybackEventHandlers`のイベント通知を利用し、Synth／Sequencerを直接参照しない。
- `spessasynth_playback.ts`がSMF・音声再生・イベント通知を担当し、`player.ts`の`PlayerControls`が`PlaybackTransport`を受け取って再生ボタンと時間表示を担当する。UIは再生インターフェースを実装せず、初期化処理がUIと再生実装を接続し、それぞれを破棄する。音声あり版では音声側の高精度時計とイベントを引き続き使い、音と演出の同期を維持している。
- `noaudio_playback.ts`は`spessasynth_core`の音声非依存SMFパーサーで元のSMFを直接読み、テンポ変更を反映した時刻・Note・Marker・ループ範囲を使う。JSON化やミュートではなく、AudioContext／AudioWorklet／サウンドフォントを初期化せずに演出だけを動かす。
- 音声あり版はPlay操作または自動再生要求で`AudioContext`の再開を試みる。開始が許可されなければPlay待ちになり、演出も先頭で待機する。

## 再生方式とqueryパラメーター

- 画面のPlayerで`Audio`（音声あり）／`No audio`（Web Audioなし）を切り替える。切り替え時は停止し、ノートとカメラをリセットして先頭に戻す。
- 自動再生は初回読み込みにだけ適用する。画面からの切り替え後はPlay待ちになる。

| パラメーター | 値 | 省略時・不正値 |
| --- | --- | --- |
| `player` | `audio` / `noaudio` | `audio` |
| `autoplay` | `1` / `0` | `0` |

例：

- `?player=noaudio&autoplay=1`：Web Audioなしで演出を自動再生する。
- `?player=audio&autoplay=1`：音声ありの自動再生を試み、ブラウザに許可されなければPlay待ちになる。
- queryなし：音声あり、Play操作で開始する。

## 確認

- `npm run build`：型チェックと本番ビルド。
- `npm test`：SMF解析、テンポ変更、イベント時刻、停止・再開・ループ、query、自動再生拒否とUIの復帰を確認する。

## MIDIの扱いに関する注意

- MIDIチャンネルは内部では0始まりで扱う。
  - 一般表記のChannel 1は`0`。
  - 一般表記のChannel 10（Drums）は`9`。
- 同一チャンネル・同一音程の複数voiceは、このビジュアライザーでは区別しない。
- Logic ProのMarkerはSMFのMarkerイベントとして書き出せる。ループ終端として解釈される`LoopEnd` Markerを設定する。
