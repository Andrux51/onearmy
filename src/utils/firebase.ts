import * as firebase from 'firebase/app'
import 'firebase/firestore'
import 'firebase/auth'
import 'firebase/storage'
import 'firebase/functions'
import 'firebase/database'
import { FIREBASE_CONFIG } from '../../src/config/config'

// initialise with config settings, additional firestore config to support future changes
firebase.initializeApp(FIREBASE_CONFIG)
firebase
  .firestore()
  .enablePersistence({ experimentalTabSynchronization: true })
  .catch(err => console.error('could not persist firestore', err))

// export firebase endpoints to be accessed by other functions
export const afs = firebase.firestore()
export const storage = firebase.storage()
export const auth = firebase.auth()
export const functions = firebase.functions()
export const rdb = firebase.database()
export const EmailAuthProvider = firebase.auth.EmailAuthProvider

// want to also expose the default firebase user
export interface IFirebaseUser extends firebase.User {}

/* Firestore use examples
   See full docs at: https://firebase.google.com/docs/firestore/

  // Get all documents in a collection
  private async getCollectionDocs() {
    const ref = await db.collection("usermeta").get();
    const docs: any[] = ref.docs.map(doc => doc.data());
    console.log("docs", docs);
  }
*/
