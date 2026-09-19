# SMFアニメーションの習作

demo https://novogrammer.github.io/smf-animation-study/

## 使用したMIDIについて

- [Timeless Truths Libraryで公開されている「When the Saints Go Marching In」のMIDIファイル（SMF）](https://library.timelesstruths.org/music/When_the_Saints_Go_Marching_In/midi/)をダウンロードし、編集して使用した。
- 演出と検証のため、ドラムパートを追加した。
- ダウンロード元の譜面に誤りが見つかったため、該当箇所を修正した。

## ビジュアライザーについて

- MIDIのNote On／Note OffをもとにADSRエンベロープを計算し、Cubeのスケール変化として表現した。
- Note Onのvelocityをスケールへ反映し、音の強弱がCubeの大きさに表れるようにした。

## MIDI制作上の注意

- MIDIチャンネルは内部では0始まりで扱う。
  - 一般表記のChannel 1は`0`。
  - 一般表記のChannel 10（Drums）は`9`。
- 同一チャンネル・同一音程の複数voiceは、このビジュアライザーでは区別しない。
- DAW上で複数voiceやリージョンを統合すると、開始位置・音程・長さが同じNoteが重複することがある。
- 完全に重なったNoteはピアノロール上で見落としやすい。今回使用したMIDIでも、Channel 0のE♭4（MIDI Note 63）などに重複が見つかった。
- 重複Noteはシンセの二重発音や、可視化状態の上書き、不自然な強調につながる。そのため、MIDI書き出し後に同一tick・同一チャンネル・同一音程のNote Onが重複していないか確認する。
- Logic ProのMarkerはSMFのMarkerイベントとして書き出せる。ループ終端は`LoopEnd` Markerで明示する。
