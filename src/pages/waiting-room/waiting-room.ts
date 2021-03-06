import { Component } from '@angular/core';
import { IonicPage, NavParams, NavController } from 'ionic-angular';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/takeUntil';
import { Subject } from 'rxjs/Subject';

import { GameModel, GameModelInterface, GameUser, GameState } from '../../providers/game-model/game-model';
import { Auth, AuthUserInfo } from '../../providers/auth/auth';
import { GameNavigationController } from '../../providers/game-navigation-controller/game-navigation-controller';

interface DisplayUser {
  name: string;
  photoURL: string;
  joined: boolean;
  host: boolean;
}

interface DisplayUsers {
  [index: number]: DisplayUser;
}

@IonicPage()
@Component({
  selector: 'waiting-room',
  templateUrl: 'waiting-room.html'
})
export class WaitingRoomPage {

  private gameKey = '';
  private isJoinable = true;
  private isHost = false;
  private isJoined = false;
  private joinedUsers: Observable<DisplayUsers> = null;
  private watchingUsers: Observable<DisplayUsers> = null;
  private ngUnsubscribe: Subject<void> = null;

  constructor(
      navParams: NavParams,
      private gameModel: GameModel,
      private socialSharing: SocialSharing,
      private auth: Auth,
      private gameNavCtrl: GameNavigationController) {
    this.gameKey = navParams.get('gameKey');
  }

  ionViewDidEnter() {
    console.log('ionViewDidEnter WaitingRoomPage');
    this.ngUnsubscribe = new Subject<void>();
    let gameInstanceObservable = this.gameModel.loadInstance(this.gameKey).takeUntil(this.ngUnsubscribe);
    gameInstanceObservable.subscribe((gameInstance: GameModelInterface) => {
      let authUserInfo: AuthUserInfo = this.auth.getUserInfo();
      if (!(authUserInfo.uid in gameInstance.users)) {
        let gameUser: GameUser = {
          uid: authUserInfo.uid,
          displayName: authUserInfo.displayName,
          photoURL: authUserInfo.photoURL,
          joined: false
        };
        this.gameModel.upsertGameUser(this.gameKey, authUserInfo.uid, gameUser);
      }
      this.isHost = authUserInfo.uid == gameInstance.creator;
      if (authUserInfo.uid in gameInstance.users) {
        this.isJoined = gameInstance.users[authUserInfo.uid].joined;
      }
      this.isJoinable = (gameInstance.state == GameState.CREATED);
    });
    let users = gameInstanceObservable.map((gameInstance: GameModelInterface) => {
      let users = new Array<DisplayUser>();
      for (let uid in gameInstance.users) {
        let gameUser = gameInstance.users[uid];
        users.push({
          name: gameUser.displayName,
          photoURL: gameUser.photoURL,
          joined: gameUser.joined,
          host: uid == gameInstance.creator
        })
      }
      return users;
    });
    this.joinedUsers = users.map((displayUsers: DisplayUsers) => {
      return Object.keys(displayUsers).map((value, index, array) => {
        return displayUsers[value];
      }).filter((value: DisplayUser, index, array) => {
        return value.joined;
      })
    });
    this.watchingUsers = users.map((displayUsers: DisplayUsers) => {
      return Object.keys(displayUsers).map((value, index, array) => {
        return displayUsers[value];
      }).filter((value: DisplayUser, index, array) => {
        return !value.joined;
      })
    });
    this.gameNavCtrl.observeAndNavigateToNextPage(this.gameKey, 'WaitingRoomPage');
  }

  doShare() {
    this.socialSharing.shareWithOptions({
      message: 'Hey, wanna join me for an EPYC game?',
      subject:'EPYC game invitation!',
      url: `https://epyc-9f15f.appspot.com/game/${this.gameKey}`,
      chooserTitle: 'Share Game'
    });
  }

  canJoin(): boolean {
    return !this.isJoined && !this.isHost;
  }

  doJoin() {
    let gameUser: GameUser = {
      joined: true
    };
    this.gameModel.upsertGameUser(this.gameKey, this.auth.getUserInfo().uid, gameUser);
  }

  canLeave(): boolean {
    return this.isJoined && !this.isHost
  }

  doLeave() {
    let gameUser: GameUser = {
      joined: false
    };
    this.gameModel.upsertGameUser(this.gameKey, this.auth.getUserInfo().uid, gameUser);
  }

  canStart(): boolean {
    return this.isHost;
  }

  doStart() {
    this.gameModel.start(this.gameKey);
  }

  ionViewWillLeave() {
    console.log('ionViewWillLeave WaitTurnRoom');
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    this.gameNavCtrl.cancelObserveAndNavigateToNextPage();    
  }
}
