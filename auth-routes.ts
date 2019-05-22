//https://www.youtube.com/watch?v=or1_A4sJ-oY
const router = require('express').Router();
import {keys} from './keys';
const passport = require('passport');
const passport_setup = require('./passport-setup');
const jwt = require('jsonwebtoken');
//var callbackURL = 'http://localhost:8080/callback';
let callbackURL = 'https://gator-ui.azurewebsites.net/callback';

//This method is not called any more, it is here for the test
router.get('/login', (req: any, res: any) => {});

router.get('/github', passport.authenticate('github'), (req: any, res: any) => {
  //This function will never be called.
});

router.get('/logout', (req: any, res: any) => {
  res.send('logging.out');
});

//callback for github to call
//in the setting of application call back is defined as /auth/github/redirect
//remember auth/ is automatically placed in front of this, because in app.ts we have defined app.use('/auth', authRoutes);
//this is callbacked with authorization Code, this code is taken by passport and made another call to get the access code
//which you can see in passport-setup.ts file
router.get('/github/redirect', passport.authenticate('github'), (req: any, res: any) => {
  const token = jwt.sign(req.user.id, 'JWTSuperSecret');
  res.redirect(callbackURL + '?token=' + token);
});

module.exports = router;
