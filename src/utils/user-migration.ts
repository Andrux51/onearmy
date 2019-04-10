// This file handles most of the logic involved with user migration
import { auth, afs } from './firebase'
import { ILegacyUser, IUser } from 'src/models/user.models'
import * as phpassHasher from 'wordpress-hash-node'

import md5 from 'md5'
import { Database } from 'src/stores/database'

interface IMigrationResponse {
  success: boolean
  message: string
  complete: boolean
}

export const loginFormSubmit = async (email: string, pw: string) => {
  const response: any = await attemptLogin(email, pw)
  return response
}

const attemptLogin = async (email: string, pw: string) => {
  // first try firebase login
  let status: IMigrationResponse = await attemptFirebaseLogin(email, pw)
  if (status.complete) {
    return status
  }
  // if doesn't exist see if legacy user does
  status = await attemptLegacyMigration(email, pw)
  return status
}

const attemptFirebaseLogin = async (email: string, pw: string) => {
  try {
    // if standard sign in successful user already has firebase profile
    // no further action required
    await auth.signInWithEmailAndPassword(email, pw)
    return {
      success: true,
      complete: true,
      message: 'User signed in successfully',
    }
  } catch (error) {
    // if not successful identify cause and return relevant status
    switch (error.code) {
      case 'auth/user-not-found':
        return buildResponse(false, 'Checking for legacy user', false)
      case 'auth/wrong-password':
        return buildResponse(false, 'Invalid password, please try again', true)
      default:
        return buildResponse(false, error.code, true)
    }
  }
}

const attemptLegacyMigration = async (email: string, pw: string) => {
  console.log('checking for legacy user')
  const userDoc = await afs.doc(`_legacyUsers/${email}`).get()
  if (userDoc.exists) {
    // legacy user exists, lets check the password and migrate if match
    const legacyDoc = userDoc.data() as ILegacyUser
    const pwVerified = await verifyUserPass(
      pw,
      legacyDoc.password,
      legacyDoc.password_alg,
    )
    if (pwVerified) {
      console.log('password successfully verified, migrating user')
      await migrateUser(email, pw, userDoc.data() as ILegacyUser)
      return buildResponse(true, 'User migrated succesfully', true)
    } else {
      return buildResponse(false, 'Invalid password, please try again', true)
    }
  }
  return buildResponse(false, 'User does not exists', true)
}

const migrateUser = async (
  email: string,
  pw: string,
  legacyDoc: ILegacyUser,
) => {
  // populate legacy data onto user doc
  const userDoc: IUser = generateNewUserDoc(email, legacyDoc)
  await afs.doc(`users/${email}`).set(userDoc)
  const credentials = await registerNewUser(email, pw)
  console.log('credentials received', credentials)
}

const generateNewUserDoc = (email: string, legacyDoc: ILegacyUser) => {
  delete legacyDoc.password
  delete legacyDoc.password_alg
  const user: IUser = {
    ...legacyDoc,
    ...Database.generateDocMeta('users'),
    verified: false,
    email,
  }
  return user
}

// run user pass through phpass/md5 algorithm checker
// could be done server side but for now packages are small
const verifyUserPass = async (
  inputPass: string,
  hashedPass: string,
  alg: 'phpass' | 'md5',
) => {
  console.log('verifying password', alg)
  return alg === 'phpass'
    ? phpassHasher.CheckPassword(inputPass, hashedPass)
    : md5(inputPass) === hashedPass
}

// standard firebase user registration
const registerNewUser = async (email: string, pw: string) => {
  console.log('registering new user')
  return auth.createUserWithEmailAndPassword(email, pw)
}

// quick method to convert arguments into response format which are used
// to communicate whether the past action was successful, any messages
// and if the overall process is now complete
const buildResponse = (
  success: boolean,
  message: string,
  complete: boolean,
) => {
  return {
    success,
    message,
    complete,
  }
}

/* General Notes
Users were initially migrated from wordpress ~65,000
Data cleaned to correct error values in excel (e.g. names starting '-')
Not all users have emails so these will need to migrate manually (possibly post in forum)
Tested with PHPass but unable to identify MD5 user with known pass to test

If process needs to be repeated (e.g. when full changeover, updated users)

*/
