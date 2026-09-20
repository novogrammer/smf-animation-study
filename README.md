# SMFアニメーションの習作

demo https://novogrammer.github.io/smf-animation-study/

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

- ブラウザの自動再生制限に対応するため、ユーザーがPlayを押したタイミングで`AudioContext`を再開する。
- ユーザー操作なしでMIDIベースの演出だけを動かす用途では、SMFの解析・タイミング処理とWeb Audioによる音声再生を分離する設計が考えられる。

## MIDIの扱いに関する注意

- MIDIチャンネルは内部では0始まりで扱う。
  - 一般表記のChannel 1は`0`。
  - 一般表記のChannel 10（Drums）は`9`。
- 同一チャンネル・同一音程の複数voiceは、このビジュアライザーでは区別しない。
- Logic ProのMarkerはSMFのMarkerイベントとして書き出せる。ループ終端として解釈される`LoopEnd` Markerを設定する。
