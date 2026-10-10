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
- ADSRとカメラ位置の計算には描画側の経過時間ではなく、Sequencerの`currentHighResolutionTime`を使用し、音声とアニメーションがずれにくいようにした。
- MIDI状態は仕様上の16チャンネル×128ノートを保持し、内部表記のChannel 0・1・9（一般表記のChannel 1・2・10）だけにチャンネル別の`InstancedMesh`を作成した。状態管理と描画対象を分離することで、表示チャンネルを変更しやすくしている。

## Markerとカメラワークについて

- MIDIファイルに`section:intro`、`section:call`、`section:response`、`section:march`、`section:finale`というMarkerを設定し、曲の構成とカメラ演出を同期させた。
- Marker間の時間をセクションの長さとして扱い、Sequencerの再生時間からカメラ位置を計算している。
- `section:finale`から`LoopEnd`までの間にIntroの開始位置へ戻し、ループ境界でカメラ位置が飛ばないようにした。

## Web Audioについて

- 描画側は`Playback`インターフェースを通して再生時刻とイベントを受け取り、Synth／Sequencerを直接参照しない。
- `spessasynth_playback.ts`がSMF・音声再生・イベント通知を担当し、`player.ts`が再生ボタンと時間表示を担当する。現在の実装では音声側の高精度時計とイベントを引き続き使い、音と演出の同期を維持している。
- ブラウザの自動再生制限に対応するため、ユーザーがPlayを押したタイミングで`AudioContext`を再開する。
- ユーザー操作なしでMIDIベースの演出だけを動かす用途では、同じ`Playback`インターフェースに対応した、SMFの解析と独自時計によるプレイヤーを追加する設計が考えられる。現在はWeb Audioで音を鳴らす実装のみを用意している。

## MIDIの扱いに関する注意

- MIDIチャンネルは内部では0始まりで扱う。
  - 一般表記のChannel 1は`0`。
  - 一般表記のChannel 10（Drums）は`9`。
- 同一チャンネル・同一音程の複数voiceは、このビジュアライザーでは区別しない。
- Logic ProのMarkerはSMFのMarkerイベントとして書き出せる。ループ終端として解釈される`LoopEnd` Markerを設定する。
