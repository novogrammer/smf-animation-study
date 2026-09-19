# SMFアニメーションの習作

demo https://novogrammer.github.io/smf-animation-study/

## 使用したMIDIについて

- [Timeless Truths Libraryで公開されている「When the Saints Go Marching In」のMIDIファイル（SMF）](https://library.timelesstruths.org/music/When_the_Saints_Go_Marching_In/midi/)をダウンロードし、編集して使用した。
- 演出と検証のため、ドラムパートを追加した。
- ダウンロード元の譜面に誤りが見つかったため、該当箇所を修正した。

## ビジュアライザーについて

- MIDIのNote On／Note OffをもとにADSRエンベロープを計算し、Cubeのスケール変化として表現した。
- Note Onのvelocityをスケールへ反映し、音の強弱がCubeの大きさに表れるようにした。
- ADSRとカメラ位置の計算には描画側の経過時間ではなく、Sequencerの`currentHighResolutionTime`を使用し、音声とアニメーションがずれにくいようにした。
- MIDI状態は仕様上の16チャンネル×128ノートを保持し、表示対象のChannel 0・1・9だけにチャンネル別の`InstancedMesh`を作成した。状態管理と描画対象を分離することで、表示チャンネルを変更しやすくしている。

## カメラワークについて

- MIDIファイルへ`section:intro`、`section:call`、`section:response`、`section:march`、`section:finale`というMarkerを設定し、曲のセクションとカメラ演出を同期させた。
- 各Markerをカメラ位置のキーフレームとして扱い、セクションの開始位置から次のセクションの位置まで、セクション全体を使ってlinearに移動させている。
- 注視点はセクション開始時に`power2.out`で切り替え、位置の継続的な移動とは異なる緩急を付けた。
- Finaleの終端位置をIntroの開始位置と同じにし、ループ時にカメラ位置が飛ばないようにした。
- PerspectiveCameraを維持し、画面の短辺を基準にFOVと表示範囲を計算することで、アスペクト比の変化に対応した。
- セクションごとにFOVを変更できる構造を残しているが、現在の`fovScale`はすべて`1`とし、ズーム演出は使用していない。
- 無地の背景だけではカメラ移動を認識しづらかったため、床・天井・左右壁・奥壁からなる白い部屋を配置した。床や壁の境界を、移動方向や距離を読み取るための空間的な手掛かりにしている。
- カメラ位置はMIDI時間から算出している一方、注視点のGSAP Tweenは実時間で進む。そのため、Marker直後に再生を一時停止すると注視点だけが移動を続ける可能性があり、厳密な同期が必要になった場合の改善候補としている。

## Web Audioについて

- ブラウザの自動再生制限に対応するため、ユーザーがPlayを押したタイミングで`AudioContext`を再開する。
- ユーザー操作なしでMIDIベースの演出だけを動かす用途では、SMFの解析・タイミング処理とWeb Audioによる音声再生を分離する設計が考えられる。

## MIDI制作上の注意

- MIDIチャンネルは内部では0始まりで扱う。
  - 一般表記のChannel 1は`0`。
  - 一般表記のChannel 10（Drums）は`9`。
- 同一チャンネル・同一音程の複数voiceは、このビジュアライザーでは区別しない。
- DAW上で複数voiceやリージョンを統合すると、開始位置・音程・長さが同じNoteが重複することがある。
- 完全に重なったNoteはピアノロール上で見落としやすい。今回使用したMIDIでも、Channel 0のE♭4（MIDI Note 63）などに重複が見つかった。
- 重複Noteはシンセの二重発音や、可視化状態の上書き、不自然な強調につながる。そのため、MIDI書き出し後に同一tick・同一チャンネル・同一音程のNote Onが重複していないか確認する。
- Logic ProのMarkerはSMFのMarkerイベントとして書き出せる。ループ終端は`LoopEnd` Markerで明示する。
