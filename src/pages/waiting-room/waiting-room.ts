import { Component } from '@angular/core';
import { NavParams, NavController } from 'ionic-angular';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/first'

import { GameModel, GameModelInterface, GameUser, GameState } from '../../providers/game-model/game-model';
import { Auth, AuthUserInfo } from '../../providers/auth/auth';

interface DisplayUser {
  name: string;
  photoURL: string;
  joined: boolean;
  host: boolean;
}

interface DisplayUsers {
  [index: number]: DisplayUser;
}

@Component({
  selector: 'waiting-room-login',
  templateUrl: 'waiting-room.html'
})
export class WaitingRoomPage {

  private gameKey = '';
  private isJoinable = true;
  private isHost = false;
  private isJoined = false;
  private joinedUsers: Observable<DisplayUsers> = null;
  private watchingUsers: Observable<DisplayUsers> = null;

  constructor(
    navParams: NavParams,
    private gameModel: GameModel,
    private socialSharing: SocialSharing,
    private auth: Auth,
    private nav: NavController) {
      this.gameKey = navParams.get('gameKey');
      let gameInstanceObservable = gameModel.loadInstance(this.gameKey);
      gameInstanceObservable.subscribe((gameInstance: GameModelInterface) => {
        auth.getUserInfo().then((authUserInfo: AuthUserInfo) => {
          if (!(authUserInfo.uid in gameInstance.users)) {
            let gameUser: GameUser = {
              uid: authUserInfo.uid,
              displayName: authUserInfo.displayName,
              photoURL: authUserInfo.photoURL,
              joined: false
            };
            gameModel.upsertGameUser(this.gameKey, authUserInfo.uid, gameUser);
          }
          this.isHost = authUserInfo.uid == gameInstance.creator;
          if (authUserInfo.uid in gameInstance.users) {
            this.isJoined = gameInstance.users[authUserInfo.uid].joined;
          }
          this.isJoinable = (gameInstance.state == GameState.CREATED);
        });
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
    this.auth.getUserInfo().then((authUserInfo: AuthUserInfo) => {      
      let gameUser: GameUser = {
        joined: true
      };
      this.gameModel.upsertGameUser(this.gameKey, authUserInfo.uid, gameUser);
    });
  }

  canLeave(): boolean {
    return this.isJoined && !this.isHost
  }

  doLeave() {
    this.auth.getUserInfo().then((authUserInfo: AuthUserInfo) => {      
      let gameUser: GameUser = {
        joined: false
      };
      this.gameModel.upsertGameUser(this.gameKey, authUserInfo.uid, gameUser);
    });
  }

  canStart(): boolean {
    return this.isHost;
  }

  doStart() {
    this.gameModel.updateState(this.gameKey, GameState.STARTED);
    // TODO: Navigate to next view.
  }
}