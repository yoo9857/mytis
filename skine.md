@charset "utf-8";

/*
 *
 * CSS CONTENTS:
 *
 * 01. Web Font
 * 02. Type Selector Reset
 * 03. Accessibility Navigation
 * 04. Layout Selector
 * 05. Components
 * 06. Entry Content
 * 07. Comment
 * 08. Aside(sidebar)
 * 09. ETC
 * 10. Option(Color Type & List Type)
 * 11. Retina Display
 * 12. Media Screen
 *
 */

/* Web Font Load */
@import url('https://fonts.googleapis.com/css?family=Nanum+Myeongjo:800&subset=korean');

/* Type Selector Reset */
body {
  -webkit-text-size-adjust: 100%;
  font-weight: 400;
  font-family: 'AppleSDGothicNeo', Pretendard-Regular, sans-serif;
  font-size: 1em;
  line-height: 1.25;
  color: #555;
}

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  font-size: 100%;
}

div, dl, dt, dd, ul, ol, li, h1, h2, h3, h4, h5, h6, pre, code, form, fieldset, legend, input, textarea, p, blockquote, th, td, figure {
  margin: 0;
  padding: 0;
}

header, footer, section, article, aside, nav, hgroup, details, menu, figure, figcaption {
  display: block;
}

button, input[type=submit], input[type=reset], input[type=button] {
  overflow: visible;
  cursor: pointer;
}

input[type=text], input[type=email], input[type=password], input[type=submit], textarea {
  -webkit-appearance: none;
}

input, select, textarea, button {
  font-family: Pretendard-Regular, sans-serif;
  font-size: 100%;
  border-radius: 0;
}

button {
  overflow: visible;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

ul li {
  list-style: none;
}

img, fieldset {
  border: none;
  /* vertical-align: top; */
}

hr {
  display: none;
}

a, a:link {
  text-decoration: none;
  color: #555;
}

a:visited {
  text-decoration: none;
}

a:hover, a:focus {
  text-decoration: underline;
  color: #222;
}

a:active {
  text-decoration: none;
}

/* Accessibility Navigation */
#acc-nav {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 100%;
  height: 0;
}

#acc-nav a {
  display: block;
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  width: 1px;
  height: 1px;
  margin-left: -1px;
  margin-bottom: -1px;
  text-align: center;
  font-weight: bold;
  font-size: 0.875em;
  color: #000;
  white-space: nowrap;
}

#acc-nav a:focus, #acc-nav a:hover, #acc-nav a:active {
  width: 100%;
  height: auto;
  padding: 10px 0;
  background: #000;
  color: #fff;
  z-index: 1000;
}

/* Layout Selector */
#header {
  border-bottom: 1px solid #eee;
}

#header .inner {
  position: relative;
  max-width: 1160px;
  margin: 0 auto;
}

#header h1 {
  padding: 23px 0;
  font-family: 'Nanum Myeongjo';
  font-weight: 800;
  font-size: 1.75em;
  line-height: 32px;
  letter-spacing: -0.2px;
  color: #333;
}

#header h1 a {
  display: inline-block;
  height: 32px;
  text-decoration: none;
  color: #333;
  vertical-align: top;
}

#header h1 img {
  width: auto;
  height: 32px;
}

#header .util {
  position: absolute;
  top: 24px;
  right: 0;
}

#header .util .search {
  position: relative;
  float: left;
  overflow: hidden;
  width: 32px;
  background-color: #fff;
  box-sizing: border-box;
  transition: width 0.5s;
  -webkit-transition: width 0.5s;
}

#header .util .search:before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  z-index: 20;
  width: 32px;
  height: 32px;
  border: 1px solid #eee;
  border-radius: 50%;
  text-indent: -999em;
  background: #fff url(./images/ico_package.png) no-repeat 0 0;
  vertical-align: top;
  box-sizing: border-box;
  outline: none;
  cursor: pointer;
}

#header .util .search input {
  width: 32px;
  height: 32px;
  padding: 5px 15px;
  border: 0;
  background-color: transparent;
  font-size: 0.875em;
  line-height: 1;
  outline: none;
  box-sizing: border-box;
}

#header .util .search input:focus {
  border-color: #484848;
}

#header .util .search input::placeholder {
  color: #969696;
}

#header .util .search button {
  position: absolute;
  top: 1px;
  right: 1px;
  z-index: 10;
  width: 30px;
  height: 30px;
  text-indent: -999em;
  border: 1px solid #eee;
  border-radius: 50%;
  background: #fff url(./images/ico_package.png) no-repeat -1px -1px;
  vertical-align: top;
  outline: none;
}

#header .util .search.on {
  width: 200px;
}

#header .util .search.on:before {
  content: none;
}

#header .util .search.on input {
  display: block;
  width: 100%;
  border: 1px solid #eee;
  border-radius: 32px;
}

#header .util .search.on button {
  border-color: transparent;
}

#header .util .profile {
  position: relative;
  float: left;
  margin-left: 14px;
}

#header .util .profile button {
  display: block;
  overflow: hidden;
  width: 32px;
  height: 32px;
  border: 1px solid #eee;
  border-radius: 50%;
}

#header .util .profile img {
  width: 100%;
  height: 100%;

}

#header .util .profile nav {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  z-index: 30;
  width: 96px;
  margin: 0 0 0 -48px;
  padding-top: 12px;
}

#header .util .profile ul {
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);
}

#header .util .profile ul li a {
  display: block;
  margin-top: -1px;
  border: 1px solid #eee;
  background-color: #fff;
  text-align: center;
  text-decoration: none;
  font-size: 0.875em;
  line-height: 2.3125rem;
  color: #777;
}

#header .util .profile ul li a:focus,
#header .util .profile ul li a:hover {
  background-color: #fafafa;
  color: #333;
}

#header .util .menu {
  display: none;
}

#gnb {
  height: 66px;
  overflow-x: auto;
  overflow-y: hidden;
  -ms-overflow-style: none;
}

#gnb::-webkit-scrollbar {
  display: none;
}

#gnb ul {
  display: inline-block;
  margin-left: -30px;
  vertical-align: top;
}

#gnb ul li {
  float: left;
  padding: 0 26px;
}

#gnb ul li a {
  position: relative;
  display: block;
  text-decoration: none;
  padding: 22px 4px 24px;
  color: #777;
}

#gnb ul li a:hover,
#gnb ul li.current a {
  color: #333;
}

#gnb ul li.current a:after,
#gnb ul li a:hover:after,
#gnb ul li a:focus:after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: #333;
}

#container {
  position: relative;
}

#container .content-wrap {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 20px;
}

#container .content-wrap:before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 10;
  width: 1px;
  height: 100%;
  margin-left: 288px;
  background-color: #eee;
}

#container .content-wrap:after {
  content: "";
  clear: both;
  display: block;
  height: 0;
  visibility: hidden;
}

#content {
  float: left;
  width: 70.7%;
  padding: 72px 0 60px;
  box-sizing: border-box;
}

#content>.inner:after {
  content: "";
  clear: both;
  display: block;
  height: 0;
  visibility: hidden;
}

#aside {
  float: right;
  width: 21.296296296296296%;
  padding: 75px 0 32px;
  box-sizing: border-box;
}

#aside .close,
#aside .profile {
  display: none;
}

#footer {
  padding: 38px 0 28px;
  border-top: 1px solid #eee;
}

#footer .inner {
  position: relative;
  max-width: 1160px;
  margin: 0 auto;
}

#footer p {
  margin-bottom: 10px;
  font-size: 0.875em;
  color: #777;
}

#footer .order-menu a {
  display: inline-block;
  margin-bottom: 23px;
  font-size: 0.8125em;
  vertical-align: middle;
  color: #555;
}

#footer .order-menu a:hover,
#footer .order-menu a:focus {
  color: #333;
}

#footer .order-menu a:before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 0 20px 2px 15px;
  background-color: #d2d2d2;
  vertical-align: middle;
}

#footer .order-menu a:first-child::before {
  content: none;
}

#footer .page-top {
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 30px;
  border: 1px solid #eee;
  border-radius: 50%;
  background: #fff url(./images/ico_package.png) no-repeat -100px -200px;
  text-indent: -999em;
}

#footer .page-top:focus,
#footer .page-top:hover {
  background-color: #757575;
  background-position-x: -150px;
}

#tt-body-index .main-slider {
  display: block;
}

#tt-body-index #content {
  padding-bottom: 43px;
}

#tt-body-index .post-cover.notice {
  height: auto;
  background-color: transparent;
}

#tt-body-index .post-cover.notice h1 {
  margin: 0;
  font-size: 1.6875em;
  line-height: 1.5;
  color: #000;
}

#tt-body-index .post-cover.notice h1 a {
  color: #000;
}

#tt-body-index .post-cover.notice .meta {
  margin: 0 0 30px;
  color: rgba(0, 0, 0, 0.6);
}

#tt-body-page #container {
  padding-top: 0px;
}

#tt-body-page.post-cover-hide #container {
  padding-top: 0;
}

#tt-body-page .post-cover {
  position: relative;
  top: -1px;
  left: 0;
  width: 100%;
}

#tt-body-tag .tags {
  margin-top: 0;
}

/* Components */
.btn, a.btn {
  display: inline-block;
  width: 100px;
  height: 36px;
  background-color: #c4c4c4;
  text-align: center;
  font-weight: 400;
  font-size: 14px;
  line-height: 36px;
  color: #fff;
  vertical-align: middle;
}

.btn:hover {
  background-color: #676767;
}

.main-slider {
  display: none;
  position: relative;
  top: -1px;
  z-index: 20;
  overflow: hidden;
  width: 100%;
  background-color: #cbcbcb;
}

.main-slider ul {
  position: relative;
}

.main-slider ul li {
  display: table;
  width: 100%;
  height: 340px;
  background-position: 50% 50%;
  background-size: cover;
}

.main-slider ul li a {
  display: table;
  width: 100%;
  height: 100%;
  text-decoration: none;
  background-color: rgba(0, 0, 0, 0.15);
}

.main-slider ul li .inner {
  display: table-cell;
  vertical-align: middle;
}

.main-slider ul li .box {
  display: block;
  max-width: 910px;
  margin: 0 auto;
  padding: 0 24px 6px;
}

.main-slider ul li .text {
  display: block;
  overflow: hidden;
  max-width: 65%;
  text-overflow: ellipsis;
  font-weight: 300;
  font-size: 2.125em;
  line-height: 1.2352;
  color: #fff;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.main-slider ul li .btn {
  display: block;
  width: 118px;
  height: 35px;
  margin-top: 32px;
  border-radius: 35px;
  line-height: 35px;
  background-color: #fff;
  color: #555;
}

.main-slider ul li .btn:hover {
  background-color: #04beb8;
  color: #fff;
}

.main-slider .prev,
.main-slider .next {
  display: none;
}

.main-slider .paging {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
  margin-left: 447px;
  transform: translateY(-50%);
  -webkit-transform: translateY(-50%);
  -ms-transform: translateY(-50%);
}

.main-slider .paging button {
  display: block;
  width: 8px;
  height: 8px;
  margin: 10px 0;
  text-indent: -999em;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
}

.main-slider .paging .current {
  background-color: rgba(255, 255, 255, 1);
}

.cover-thumbnail-1 {
  position: relative;
  margin-bottom: 77px;
}

.cover-thumbnail-1 h2 {
  margin-bottom: 19px;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-thumbnail-1 ul {
  display: inline-block;
  width: 103.378378378378378%;
  margin-left: -3.378378378378378%;
  margin-bottom: -40px;
  vertical-align: top;
}

.cover-thumbnail-1 ul li {
  float: left;
  width: 33.333333333333333%;
  padding-left: 3.26797385620915%;
  margin: 0 0 38px;
  box-sizing: border-box;
}

.cover-thumbnail-1 ul li a {
  display: block;
  text-decoration: none;
}

.cover-thumbnail-1 ul li a:hover .title,
.cover-thumbnail-1 ul li a:focus .title {
  text-decoration: underline;
}

.cover-thumbnail-1 ul li figure {
  display: block;
  height: 0;
  margin-bottom: 9px;
  padding-bottom: 130.434782608695652%;
  background-color: #f8f8f8;
}

.cover-thumbnail-1 ul li figure img {
  width: 100%;
  height: auto;
}

.cover-thumbnail-1 ul li .title {
  display: block;
  overflow: hidden;
  width: 95%;
  margin-bottom: 2px;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.75;
}

.cover-thumbnail-1 ul li .date {
  display: block;
  font-size: 0.75em;
  color: #999;
}

.cover-thumbnail-1 .more {
  position: absolute;
  top: 4px;
  right: 0;
  font-weight: 300;
  font-size: 0.875em;
  color: #999;
}

.cover-thumbnail-2 {
  position: relative;
  overflow: hidden;
  width: 100%;
  margin-bottom: 77px;
}

.cover-thumbnail-2 h2 {
  margin-bottom: 28px;
  padding-bottom: 19px;
  border-bottom: 1px solid #eee;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-thumbnail-2 ul li {
  overflow: hidden;
  margin-top: 28px;
}

.cover-thumbnail-2 ul li a {
  display: block;
  text-decoration: none;
}

.cover-thumbnail-2 ul li a:hover .title,
.cover-thumbnail-2 ul li a:focus .title {
  text-decoration: underline;
}

.cover-thumbnail-2 ul li figure {
  float: right;
  width: 128px;
  margin-left: 57px;
}

.cover-thumbnail-2 ul li figure img {
  width: 100%;
  height: auto;
  border: 1px solid #f1f1f1;
  box-sizing: border-box;
}

.cover-thumbnail-2 ul li .title {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 10px;
  padding-top: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.25em;
  line-height: 1.4;
}

.cover-thumbnail-2 ul li .excerpt {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 20px;
  text-overflow: ellipsis;
  font-size: 0.875em;
  line-height: 1.5rem;
  color: #999;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.cover-thumbnail-2 ul li .meta {
  display: block;
  font-size: 0.75em;
  color: #999;
}

.cover-thumbnail-2 ul li .meta span:before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 0 8px 0 5px;
  background-color: #d2d2d2;
  vertical-align: middle;
}

.cover-thumbnail-2 ul li .meta span:first-child:before {
  content: none;
}

.cover-thumbnail-2 .more {
  display: block;
  width: 100%;
  margin-top: 28px;
  padding: 12px 0 11px;
  border: 1px solid #eee;
  text-align: center;
  font-size: 0.875em;
  color: #999;
}

.cover-thumbnail-3 {
  position: relative;
  margin-bottom: 77px;
}

.cover-thumbnail-3 h2 {
  margin-bottom: 19px;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-thumbnail-3 ul {
  position: relative;
  display: inline-block;
  width: 103.378378378378378%;
  margin-left: -3.378378378378378%;
  margin-bottom: -25px;
  vertical-align: top;
}

.cover-thumbnail-3 ul li {
  float: left;
  width: 20%;
  margin-bottom: 22px;
  padding-left: 3.26797385620915%;
  box-sizing: border-box;
}

.cover-thumbnail-3 ul li a {
  display: block;
  text-decoration: none;
}

.cover-thumbnail-3 ul li a:hover .title,
.cover-thumbnail-3 ul li a:focus .title {
  text-decoration: underline;
}

.cover-thumbnail-3 ul li figure {
  display: block;
  width: 100%;
  height: 0;
  margin-bottom: 11px;
  padding-bottom: 129.6875%;
  background-color: #f8f8f8;
}

.cover-thumbnail-3 ul li figure img {
  width: 100%;
  height: auto;
  border: 1px solid #f1f1f1;
  box-sizing: border-box;
}

.cover-thumbnail-3 ul li .title {
  display: block;
  overflow: hidden;
  width: 95%;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125em;
  line-height: 1.4;
}

.cover-thumbnail-3 button {
  position: absolute;
  top: -1px;
  width: 24px;
  height: 24px;
  border: 1px solid #eee;
  border-radius: 50%;
  background: url(./images/ico_package.png) no-repeat 0 -50px;
  text-indent: -999em;
  outline: none;
}

.cover-thumbnail-3 .prev {
  right: 30px;
}

.cover-thumbnail-3 .next {
  right: 0;
  background-position-x: -50px;
}

.cover-thumbnail-3 button:focus,
.cover-thumbnail-3 button:hover {
  background-color: #757575;
  background-position-y: -74px;
}

.cover-thumbnail-4 {
  position: relative;
  margin-bottom: 17px;
}

.cover-thumbnail-4 h2 {
  margin-bottom: 19px;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-thumbnail-4 ul {
  position: relative;
  display: inline-block;
  width: 103.378378378378378%;
  margin-left: -3.378378378378378%;
  vertical-align: top;
}

.cover-thumbnail-4 ul li {
  float: left;
  width: 33.333333333333333%;
  min-height: 283px;
  padding-left: 3.26797385620915%;
  margin: 0 0 55px;
  box-sizing: border-box;
}

.cover-thumbnail-4 ul li a {
  display: block;
  text-decoration: none;
}

.cover-thumbnail-4 ul li a:hover .title,
.cover-thumbnail-4 ul li a:focus .title {
  text-decoration: underline;
}

.cover-thumbnail-4 ul li figure {
  display: block;
  width: 100%;
  height: 0;
  margin-bottom: 5px;
  padding-bottom: 60.869565217391304%;
  background-color: #f8f8f8;
}

.cover-thumbnail-4 ul li figure img {
  width: 100%;
  height: auto;
}

.cover-thumbnail-4 ul li .title {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 4px;
  padding-top: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.cover-thumbnail-4 ul li .excerpt {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 15px;
  text-overflow: ellipsis;
  font-size: 0.8125em;
  line-height: 1.5rem;
  color: #999;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.cover-thumbnail-4 ul li .meta {
  display: block;
  font-size: 0.75em;
  color: #999;
}

.cover-thumbnail-4 ul li .meta span:before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 7px 8px 9px 5px;
  background-color: #d2d2d2;
  vertical-align: top;
}

.cover-thumbnail-4 ul li .meta span:first-child:before {
  content: none;
}

.cover-thumbnail-4 button {
  position: absolute;
  top: -1px;
  width: 24px;
  height: 24px;
  border: 1px solid #eee;
  border-radius: 50%;
  background: url(./images/ico_package.png) no-repeat 0 -50px;
  text-indent: -999em;
  outline: none;
}

.cover-thumbnail-4 .prev {
  right: 30px;
}

.cover-thumbnail-4 .next {
  right: 0;
  background-position-x: -50px;
}

.cover-thumbnail-4 button:focus,
.cover-thumbnail-4 button:hover {
  background-color: #757575;
  background-position-y: -74px;
}

.cover-list {
  position: relative;
  overflow: hidden;
  width: 100%;
  margin-bottom: 42px;
}

.cover-list h2 {
  margin-bottom: 35px;
  padding-bottom: 19px;
  border-bottom: 1px solid #eee;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-list ul li {
  overflow: hidden;
  margin-bottom: 33px;
}

.cover-list ul li a {
  display: block;
  text-decoration: none;
}

.cover-list ul li a:hover .title,
.cover-list ul li a:focus .title {
  text-decoration: underline;
}

.cover-list ul li .title {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.25em;
  line-height: 1.4;
}

.cover-list ul li .excerpt {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 18px;
  text-overflow: ellipsis;
  font-size: 0.875em;
  line-height: 1.5rem;
  color: #999;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.cover-list ul li .date {
  display: block;
  font-size: 0.75em;
  color: #999;
}

.cover-list .more {
  position: absolute;
  top: 4px;
  right: 0;
  font-weight: 300;
  font-size: 0.875em;
  color: #999;
}

.cover-event {
  margin-bottom: 57px;
}

.cover-event h2 {
  margin-bottom: 19px;
  font-weight: 500;
  font-size: 1em;
  color: #555;
}

.cover-event ul {
  display: inline-block;
  width: 102.702702702702703%;
  margin-left: -2.702702702702703%;
  vertical-align: top;
}

.cover-event ul li {
  float: left;
  width: 50%;
  padding-left: 2.631578947368421%;
  margin: 0 0 20px;
  box-sizing: border-box;
}

.cover-event ul li a {
  position: relative;
  display: block;
  padding-bottom: 33.333333333333333%;
  border: 1px solid #eee;
  background-color: #757575;
  background-repeat: no-repeat;
  background-position: 50% 50%;
  background-size: cover;
  text-decoration: none;
  color: #555;
}

.cover-event ul li a:hover,
.cover-event ul li a:focus {
  color: #333;
}

.cover-event ul li a:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.15);
}

.cover-event ul li .title {
  position: absolute;
  top: 15%;
  left: 24px;
  z-index: 30;
  overflow: hidden;
  max-width: 60%;
  margin-bottom: 7px;
  padding-top: 9px;
  text-overflow: ellipsis;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: #fff;
}

.cover-event ul li .more {
  position: absolute;
  bottom: 20.833333333333333%;
  left: 24px;
  z-index: 30;
  text-decoration: underline;
  font-size: 0.875em;
  color: rgba(255, 255, 255, 0.6);
}

.post-cover {
  position: relative;
  z-index: 20;
  display: table;
  width: 100%;
  height: 0px;
  
  background-position: 50% 50%;
  background-size: cover;
  box-sizing: border-box;
}

.post-cover:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  
}

.post-cover .inner {
  display: table-cell;
  position: relative;
  z-index: 10;
  vertical-align: bottom;
  padding-bottom: 78px;
}

.post-cover .category {
  display: block;
  max-width: 1160px;
  margin: 0 auto 10px;
  font-size: 0.8em;
  font-weight: bold;
  color: #3db39e;
}

.post-cover h1 {
  max-width: 1160px;
  margin: 0 auto;
  font-weight: 600;
  font-size: 1.5em;
  line-height: 1.1;
  color: #444444;
}

.post-cover a {
  text-decoration: none;
  color: #fff;
}

.post-cover .meta {
  display: block;
  max-width: 1160px;
  margin: 24px auto -30px;
  border-bottom: 1px dashed #d5d5d5;
  padding: 0 0 20px 0 ;
  font-size: 0.72em;
  color: #b4b6b4;
}

.post-cover .meta a {
  color: #d4bca7;
}

.post-cover .meta a:before{
  color : #7a583a;
}
.post-cover .meta span:before {
  content: "";
  display: inline-block;
  width: 1px;
  height: 9px;
  margin: 0 9px;
  background-color: #b3b3b3;
  vertical-align: middle;
}

.post-cover .meta span:first-child:before {
  content: none;
}

.post-header {
  padding-top: 4px;
}

.post-header h1 {
  margin-bottom: 18px;
  font-size: 1em;
  line-height: 1.375;
}

#tt-body-archive .post-header span:before {
  content: "'";
}

#tt-body-archive .post-header span:after {
  content: "' ???깅줉??湲";
}

#tt-body-tag .post-header span:before {
  content: "#";
}

#tt-body-search .post-header span:before {
  content: "'";
}

#tt-body-search .post-header span:after {
  content: "'??寃?됯껐怨?;
}

.post-header h1 em {
  margin-left: 7px;
  font-style: normal;
  color: #04beb8;
}

.post-item {
  float: left;
  width: 31.081081081081081%;
  margin: 0 0 58px 3.378378378378378%;
}

.post-item:nth-child(3n+1) {
  clear: both;
  margin-left: 0;
}

.post-item a {
  display: block;
  text-decoration: none;
}

.post-item a:hover .title,
.post-item a:focus .title {
  text-decoration: underline;
}

.post-item .thum {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  height: 0;
  margin-bottom: 5px;
  padding-bottom: 60.869565217391304%;
  background-color: #f8f8f8;
}

.post-item .thum img {
  width: 100%;
  height: auto;
  transform: translateY(-25%);
  -webkit-transform: translateY(-25%);
  -ms-transform: translateY(-25%);
}

.post-item .title {
  display: block;
  overflow: hidden;
  max-width: 98%;
  margin-bottom: 4px;
  padding-top: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.post-item .excerpt {
  display: block;
  overflow: hidden;
  max-width: 95%;
  margin-bottom: 15px;
  text-overflow: ellipsis;
  font-size: 0.8125em;
  line-height: 1.5rem;
  color: #999;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.post-item .meta {
  display: block;
  font-size: 0.75em;
  color: #999;
}

.post-item .meta span:before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 0 8px 0 5px;
  background-color: #d2d2d2;
  vertical-align: middle;
}

.post-item .meta span:first-child:before {
  content: none;
}

.post-item.protected .thum:before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 34px;
  height: 47px;
  margin: -24px 0 0 -17px;
  background: url(./images/ico_package.png) no-repeat 0 -120px;
  background-size: 120px auto;
}

.not-found {
  display: block;
  width: 100%;
  margin-bottom: 35px;
}

.not-found li {
  position: relative;
  padding-left: 10px;
  font-size: 0.9375em;
  line-height: 2;
  color: #999;
}

.not-found li:before {
  content: "";
  position: absolute;
  top: 15px;
  left: 0;
  width: 2px;
  height: 2px;
  background-color: #999;
}

.not-found .tag,
.not-found .category,
.not-found .archive {
  display: none;
}

#tt-body-tag .not-found ul,
#tt-body-category .not-found ul,
#tt-body-archive .not-found ul {
  display: none;
}

#tt-body-tag .not-found .tag,
#tt-body-category .not-found .category,
#tt-body-archive .not-found .archive {
  display: block;
}

.pagination {
  margin-bottom: 60px;
  text-align: center;
}

.pagination a {
  display: inline-block;
  margin: 0 12px;
  font-size: 0.875em;
  line-height: 1.5rem;
  vertical-align: top;
  color: #999;
}

.pagination .selected {
  color: #333;
}

.pagination .prev,
.pagination .next {
  width: 22px;
  height: 22px;
  border: 1px solid #eee;
  border-radius: 50%;
  background: url(./images/ico_package.png) no-repeat 0 -50px;
  text-indent: -999em;
}

.pagination .next {
  background-position-x: -50px;
}

.pagination .view-more {
  display: block;
  margin: 0;
  padding: 12px 0 11px;
  border: 1px solid #eee;
  text-align: center;
  font-size: 0.875em;
  color: #999;
}

.tags {
  margin-bottom: 45px;
  font-size: 0;
}

.tags:after {
  content: "";
  clear: both;
  display: block;
  height: 0;
  visibility: hidden;
}

.tags h2 {
  margin-bottom: 15px;
  font-weight: 600;
  font-size: 16px;
}

.tags a {
  display: inline-block;
  margin: 0 8px 12px 0;
  padding: 0 17px;
  border: 1px solid #eee;
  border-radius: 32px;
  font-size: 14px;
  line-height: 30px;
  vertical-align: middle;
  color: #555;
}

.tags a:hover,
.tags a:focus {
  color: #333;
}

.page-nav {
  margin: 52px 0 60px 0;
  padding: 23px 0 20px;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.page-nav a {
  display: block;
  overflow: hidden;
  padding-left: 58px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875em;
  line-height: 2.125rem;
  color: #555;
}

.page-nav a:hover,
.page-nav a:focus {
  color: #333;
}

.page-nav a strong {
  float: left;
  width: 58px;
  margin-left: -58px;
  font-weight: 400;
  color: #999;
}

.page-nav a strong:after {
  content: "";
  display: inline-block;
  width: 1px;
  height: 5px;
  margin: 0 8px;
  background: url(./images/ico_package.png) no-repeat -150px -50px;
  vertical-align: middle;
}

.related-articles {
  margin-bottom: 55px;
}

.related-articles h2 {
  margin-bottom: 15px;
  font-weight: 600;
  font-size: 1em;
}

.related-articles ul {
  display: inline-block;
  width: 101.621621621621622%;
  margin-left: -1.621621621621622%;
  vertical-align: top;
}

.related-articles ul li {
  float: left;
  width: 25%;
  padding-left: 1.621621621621622%;
  box-sizing: border-box;
}

.related-articles ul li:first-child {
  margin-left: 0;
}

.related-articles ul li a {
  color: #555;
}

.related-articles ul li a:hover,
.related-articles ul li a:focus {
  color: #333;
}

.related-articles ul li figure {
  display: block;
  width: 100%;
  height: 0;
  margin-bottom: 9px;
  padding-bottom: 68.181818181818182%;
  background-color: #f8f8f8;
}

.related-articles ul li figure img {
  width: 100%;
  height: auto;
}

.related-articles ul li .title {
  display: block;
  overflow: hidden;
  max-width: 95%;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875em;
  line-height: 1.4;
}

/* Entry Content */
.entry-content h1 {
  clear: both;
  margin: 29px 0 22px;
  font-size: 1.6875em;
  line-height: 1.5;
  color: #000;
}

.entry-content h2 {
  clear: both;
  margin: 29px 0 22px;
  font-size: 1.5em;
  line-height: 1.5;
  color: #000;
}

.entry-content h3 {
  clear: both;
  margin: 29px 0 22px;
  font-size: 1.3125em;
  line-height: 1.5;
  color: #000;
}

.entry-content h4 {
  clear: both;
  margin: 29px 0 22px;
  font-weight: 400;
  font-size: 1.125em;
  line-height: 1.5;
  color: #000;
}

.entry-content p {
  word-break: break-word;
}

.entry-content p img {
  max-width: 100%;
  height: auto;
}

.entry-content hr {
  display: block;
  height: 0;
  border: 0;
  border-bottom: 1px solid #000;
}

.entry-content pre {
  word-break: break-word;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.entry-content ul {
  list-style: disc;
  margin-bottom: 22px;
  padding: revert;
}

.entry-content ul li {
  position: relative;
  margin-bottom: 10px;
  list-style: inherit;
}

.entry-content ol {
  list-style: decimal inside;
  margin-bottom: 22px;
}

.entry-content ol li {
  position: relative;
  margin-bottom: 10px;
  text-indent: -15px;
  list-style: inherit;
}

.entry-content img.alignleft {
  float: left;
  margin: 0 22px 22px 0;
}

.entry-content img.aligncenter {
  display: block;
  margin: 0 auto 22px;
}

.entry-content img.alignright {
  float: right;
  margin: 0 0 22px 22px;
}

.entry-content blockquote {
  margin-bottom: 40px;
  padding: 16px 20px;
  border-left: 4px solid #e6e6e6;
}

.entry-content blockquote p {
  margin: 22px 0 0;
}

.entry-content blockquote p:first-child {
  margin-top: 0;
}

.entry-content input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid #e6e6e6;
  font-size: 0.875em;
  line-height: 1.25;
  color: #666;
  box-sizing: border-box;
  vertical-align: middle;
}

.entry-content .entry-content .protected_form {
  margin-bottom: 40px;
  padding: 120px 0 200px;
  border-bottom: 1px solid #7a583a;
  text-align: center;
}

.entry-content .entry-content .protected_form input {
  width: 200px;
  margin-bottom: 10px;
  vertical-align: top;
}

.entry-content .cap1 {
  text-align: center;
  font-size: 0.875em;
  font-style: italic;
}

.entry-content .iframe-wrap {
  position: relative;
  height: 0;
  padding-bottom: 56.25%;
}

.entry-content .iframe-wrap iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.entry-content .protected_form {
  display: block;
  width: 100%;
  padding: 98px 0 120px;
  text-align: center;
}

.entry-content .protected_form h2 {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 1.625em;
  line-height: 2.125rem;
  color: #555;
}

.entry-content .protected_form p {
  margin-bottom: 34px;
  font-weight: 300;
  font-size: 1em;
  line-height: 1.75;
  color: #999;
}

.entry-content .protected_form input {
  width: 183px;
  padding: 0 23px;
  border: 1px solid #eee;
  font-size: 0.9125em;
  line-height: 2.125rem;
}

.entry-content .protected_form input:focus {
  border-color: #484848;
}

.entry-content .protected_form .btn {
  margin-left: 5px;
}

/* Comment */
.comments {
  margin-bottom: 60px;
}

.comments h2 {
  margin-bottom: 15px;
  font-weight: 600;
  font-size: 1em;
}

.comments h2 .count {
  margin-left: 4px;
  color: #04beb8;
}

.comment-list {
  margin-bottom: 60px;
  border-top: 1px solid #eee;
}

.comment-list ul li {
  display: inline-block;
  width: 100%;
  padding: 32px 0 28px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
  box-sizing: border-box;
}

.comment-list .tt_more_preview_comments_wrap {
  padding: 0;
  border: 0;
}

.comment-list .tt_more_preview_comments_text {
  display: block;
  margin: -1px 0 0;
  padding: 12px 0 11px;
  border: 1px solid #eee;
  text-align: center;
  font-size: 0.875em;
  color: #999;
}

.comment-list .tt_more_preview_comments_text:hover {
  text-decoration: underline;
}

.comment-list ul li .author-meta {
  position: relative;
  margin-bottom: 7px;
  padding: 2px 0 0 60px;
  font-size: 0.8125em;
  color: #999;
}

.comment-list ul li .author-meta a {
  color: #999;
}

.comment-list ul li .author-meta a:before,
.comment-list ul li .author-meta span:before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 0 7px 0 5px;
  background-color: #e3e3e3;
  vertical-align: middle;
}

.comment-list ul li .author-meta .nickname {
  font-weight: 700;
  color: #555;
}

.comment-list ul li .author-meta .nickname a {
  color: #555;
}

.comment-list ul li .author-meta .avatar {
  float: left;
  width: 46px;
  margin: -2px 0 0 -60px;
  border: 1px solid #eee;
  border-radius: 50%;
}

.comment-list ul li .author-meta .control {
  position: absolute;
  top: 0;
  right: -9px;
  border-bottom: 0;
}

.comment-list ul li .author-meta .control button {
  content: "";
  display: block;
  width: 20px;
  height: 20px;
  background: url(./images/ico_package.png) no-repeat -141px 5px;
  text-indent: -999em;
}

.comment-list ul li .author-meta .control .link {
  display: none;
  position: absolute;
  top: 100%;
  left: -65px;
  width: 70px;
  text-align: center;
}

.comment-list ul li .author-meta .control .link a {
  display: block;
  margin-top: -1px;
  border: 1px solid #e0e0e0;
  background-color: #fff;
  text-decoration: none;
  font-size: 0.875em;
  line-height: 1.5rem;
  color: #333;
}

.comment-list ul li .author-meta .control .link a:focus,
.comment-list ul li .author-meta .control .link a:hover {
  background-color: #fafafa;
  color: #222;
}

.comment-list ul li .author-meta .nickname:before,
.comment-list ul li .author-meta .nickname a:before,
.comment-list ul li .author-meta .control:before,
.comment-list ul li .author-meta .control a:before {
  content: none;
}

.comment-list ul li p {
  max-width: 85%;
  padding: 0 0 0 60px;
  font-size: 0.875em;
  line-height: 1.3125rem;
  color: #777;
  box-sizing: border-box;
}

.comment-list ul li .reply {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.8125rem;
  color: #999;
}

.comment-list ul li ul {
  margin: 28px 0 -32px 0;
  padding: 26px 0 21px;
  border-top: 1px solid #eee;
  background-color: #fafafa;
}

.comment-list ul li ul li {
  padding: 14px 0 15px 60px;
  border-bottom: 0;
}

.comment-list ul li ul li .author-meta {
  margin-bottom: 8px;
}

.comment-list ul li ul li .author-meta .control {
  right: 15px;
}

.comment-list ul li ul li .author-meta .avatar {
  width: 42px;
}

.comment-list ul li ul li p {
  max-width: 80%;
}

.comment-list ul li ul .tt_more_preview_comments_wrap {
  display: block;
}

.comment-list ul li ul .tt_more_preview_comments_text {
  margin-bottom: 16px;
  border-top: 0;
  border-left: 0;
  border-right: 0;
}

.comment-list ul li ul .tt_more_preview_comments_text:first-child {
  margin-top: -24px;
  padding: 12px 0 11px;
}

.comment-form {
  position: relative;
  margin-bottom: 60px;
}

.comment-form .field {
  overflow: hidden;
  margin-bottom: -1px;
  border: 1px solid #eee;
}

.comment-form .field input[type=text],
.comment-form .field input[type=password] {
  float: left;
  width: 50%;
  padding: 12px 16px;
  border: 0;
  border-left: 1px solid #eee;
  font-size: 0.875em;
  color: #777;
  box-sizing: border-box;
}

.comment-form .field input:first-child {
  border-left: 0;
}

.comment-form textarea {
  display: block;
  width: 100%;
  margin-bottom: 20px;
  padding: 16px 100px 16px 16px;
  border: 1px solid #eee;
  font-size: 0.875em;
  color: #777;
  box-sizing: border-box;
  resize: none;
}

.comment-form input::-webkit-input-placeholder,
.comment-form textarea::-webkit-input-placeholder {
  color: #999;
}

.comment-form .secret {
  position: absolute;
  left: 0;
  bottom: 8px;
}

.comment-form .secret input {
  display: none;
}

.comment-form .secret label {
  display: inline-block;
  font-size: 0.8125em;
  line-height: 1.25rem;
  color: #666;
  outline: none;
  cursor: pointer;
}

.comment-form .secret label:before {
  content: "";
  display: inline-block;
  width: 19px;
  height: 18px;
  margin-right: 12px;
  border: 1px solid #e1e1e1;
  vertical-align: top;
  background-color: #fff;
}

.comment-form .secret input[type=checkbox]:checked+label:before {
  background: url(./images/ico_package.png) no-repeat -47px 4px;
}

.comment-form .submit {
  text-align: right;
}

.comment-form .submit button {
  background-color: #333;
  color: #fff;
}

.comment-form .submit button:hover,
.comment-form .submit button:focus {
  background-color: #04beb8;
}

/* Aside(sidebar) */
.sidebar h2 {
  margin-bottom: 7px;
  font-weight: 500;
  font-size: 0.875em;
  color: #555;
}

.sidebar ul li {
  padding: 4px 0 5px;
  font-size: 0.8125em;
  line-height: 1.25rem;
  color: #777;
}

.sidebar ul li a {
  color: #777;
}

.sidebar ul li a:hover {
  color: #333;
}

.sidebar .sidebar-2 {
  margin-top: 38px;
  padding-top: 46px;
  border-top: 1px solid #eee;
}

.sidebar .category {
  margin-bottom: 36px;
}

.sidebar .category ul li {
  padding: 0;
  font-size: 0.875em;
  font-weight: 600;
}

.sidebar .category ul li a {
  color: #555;
}

.sidebar .category ul li a:hover {
  color: #333;
}

.sidebar .category ul li ul {
  padding-top: 8px;
}

.sidebar .category ul li ul li {
  padding: 6px 0 7px;
  font-weight: 400;
  font-size: 1em;
}

.sidebar .category ul li ul li ul {
  overflow: hidden;
  margin-bottom: -4px;
  padding-top: 6px;
}

.sidebar .category ul li ul li ul li {
  position: relative;
  padding: 3px 0 3px 9px;
  /* border-left: 2px solid #eee; */
  font-size: 0.8125rem;
}

.sidebar .category ul li ul li ul li:before {
  content: "";
  position: absolute;
  bottom: 7px;
  left: 0;
  width: 2px;
  height: 100%;
  background-color: #eee;
}

.sidebar .category ul li ul li ul li:first-child:before {
  top: 7px;
  bottom: auto;
}

.sidebar .category ul li ul li ul li a {
  color: #999;
}

.sidebar .notice {
  margin-bottom: 37px;
}

.sidebar .recent-comment {
  margin-bottom: 36px;
}

.sidebar .recent-comment ul li a {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar .post-list {
  margin-bottom: 46px;
}

.sidebar .post-list h2 {
  margin-bottom: 12px;
}

.sidebar .post-list ul li {
  overflow: hidden;
  margin-bottom: 18px;
  padding: 0;
}

.sidebar .post-list ul li img {
  float: right;
  width: 58px;
  height: 58px;
  margin: 2px 0 0 20px;
}

.sidebar .post-list ul li a {
  display: block;
  overflow: hidden;
  text-decoration: none;
}

.sidebar .post-list ul li a:hover .title {
  text-decoration: underline;
}

.sidebar .post-list ul li .title {
  display: block;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sidebar .post-list ul li .date {
  display: block;
  margin-top: 6px;
  font-size: 0.75rem;
  line-height: 1;
}

.sidebar .social-list {
  margin-bottom: 46px;
}

.sidebar .social-list h2 {
  margin-bottom: 18px;
}

.sidebar .social-list .tab-list {
  overflow: hidden;
  width: 100%;
}

.sidebar .social-list ul li {
  margin-bottom: 15px;
  padding: 0 0 0 48px;
}

.sidebar .social-list ul li a {
  display: block;
  text-decoration: none;
}

.sidebar .social-list ul li a:hover .text {
  text-decoration: underline;
}

.sidebar .social-list ul li .avatar {
  float: left;
  overflow: hidden;
  width: 40px;
  height: 40px;
  margin-left: -48px;
  border-radius: 50%;
}

.sidebar .social-list ul li .title {
  display: block;
}

.sidebar .social-list ul li .date {
  display: block;
  margin-top: 6px;
  font-size: 0.75rem;
  color: #777;
}

#aside .tags {
  margin: 0 0 41px;
  padding: 0;
  font-size: 1em;
}

#aside .tags h2 {
  margin-bottom: 8px;
  font-size: 0.875em;
}

#aside .tags a {
  float: none;
  margin: 0 4px 0 0;
  padding: 0;
  border: 0;
  font-size: 0.8125em;
  line-height: 2;
  color: #555;
}

#aside .tags a:after {
  content: ", ";
}

#aside .tags a:last-child:after {
  content: none;
}

#aside .tags a:hover,
#aside .tags a:focus {
  color: #333;
}

.sidebar .count {
  margin-bottom: 46px;
}

.sidebar .count h2 {
  margin-bottom: 3px;
}

.sidebar .count h2:before {
  content: "";
  display: block;
  width: 17px;
  height: 1px;
  margin-bottom: 18px;
  background-color: #555;
}

.sidebar .count p {
  margin-bottom: 6px;
  font-size: 0.8125em;
  color: #777;
}

.sidebar .count .total {
  margin-bottom: 12px;
  font-weight: 700;
  font-size: 1.875em;
  color: #555;
}

.sidebar .social-channel {
  margin-bottom: 48px;
}

.sidebar .social-channel ul {
  overflow: hidden;
  width: 100%;
}

.sidebar .social-channel ul li {
  float: left;
  margin-left: 10px;
  padding: 0;
}

.sidebar .social-channel ul li:first-child {
  margin-left: 0;
}

.sidebar .social-channel ul li a {
  display: block;
  width: 34px;
  height: 34px;
  border: 1px solid #eee;
  border-radius: 50%;
  text-indent: -999em;
  background: url(./images/ico_package.png) no-repeat 0 -100px;
}

.sidebar .social-channel ul li.youtube a {
  background-position-x: -50px;
}

.sidebar .social-channel ul li.instagram a {
  background-position-x: -100px;
}

.sidebar .social-channel ul li.twitter a {
  background-position-x: -150px;
}

.sidebar .social-channel ul li a:focus,
.sidebar .social-channel ul li a:hover {
  background-color: #757575;
  background-position-y: -150px;
}

.sidebar .tab-ui h2 a {
  color: #999;
}

.sidebar .tab-ui h2 a.current {
  color: #555;
}

.sidebar .tab-ui h2 a:before {
  content: "";
  display: inline-block;
  width: 1px;
  height: 5px;
  margin: 0 10px;
  vertical-align: middle;
  background: url(./images/ico_package.png) no-repeat -100px -50px;
}

.sidebar .tab-ui h2 a:first-child:before {
  content: none;
}

/* ETC */
#dimmed {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 300;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
}

.mobile-menu {
  overflow: hidden;
  height: 100%;
}

.slide-wrap {
  overflow: hidden;
}

/* Overwrite */
#content .another_category {
  margin: 60px 0 57px !important;
  padding: 16px 20px 14px;
}

#content .another_category h4 {
  margin: 0 0 13px !important;
  ;
  padding: 0 !important;
  border-bottom: 0 !important;
  font-size: 0.875em !important;
}

#content .another_category table {
  margin: 0 !important;
  border: 0;
}

#content .another_category th {
  padding: 2px 0 !important;
  font-size: 0.875rem !important;
}

#content .another_category th a.current {
  text-decoration: underline !important;
  font-weight: 400;
  color: #333 !important;
  border: 0 !important;
}

#content .another_category td {
  padding: 2px 0 !important;
  border: 0;
  font-size: 0.75rem !important;
}

.container_postbtn {
  margin: 53px 0 55px;
  padding: 0 !important;
}

.absent_post:before {
  content: "二꾩넚?⑸땲?ㅻ쭔 \A湲??李얠? 紐삵뻽?듬땲??";
  display: block;
  margin-bottom: 7px;
  font-weight: bold;
  font-size: 1.75em;
  line-height: 1.285714285714286;
  color: #555;
  white-space: pre;
}

.absent_post {
  padding: 98px 0 !important;
  background: none !important;
  font-weight: normal !important;
  font-size: 1em !important;
  line-height: 1.75;
  color: #999 !important;
}

/* Option(Color Type & List Type) */
.layout-aside-left #content {
  float: right;
}

.layout-aside-left #aside {
  float: left;
  margin-left: 0;
  padding: 80px 0;
}

.layout-aside-left #container .content-wrap:before {
  margin-left: -289px;
}

.list-type-vertical .post-item {
  margin-bottom: 38px;
}

.list-type-vertical .post-item .thum {
  margin-bottom: 3px;
  padding-bottom: 130.434782608695652%;
}

.list-type-vertical .post-item .thum img {
  transform: translateY(0);
  -webkit-transform: translateY(0);
  -ms-transform: translateY(0);
}

.list-type-vertical .post-item .title {
  margin-bottom: 5px;
}

.list-type-vertical .post-item .excerpt,
.list-type-vertical .post-item .meta .comment {
  display: none;
}

.list-type-vertical .post-item .meta span:before {
  content: none;
}

.list-type-thumbnail .post-header {
  margin-bottom: 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eee;
}

.list-type-thumbnail .post-header h1 {
  margin-bottom: 0;
}

.list-type-thumbnail .post-item {
  float: none;
  overflow: hidden;
  width: 100%;
  margin: 0 0 28px;
}

.list-type-thumbnail .post-item .thum {
  display: inline;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
}

.list-type-thumbnail .post-item .thum img {
  float: right;
  width: 126px;
  height: auto;
  margin-left: 57px;
  border: 1px solid #f1f1f1;
  transform: translateY(0);
  -webkit-transform: translateY(0);
  -ms-transform: translateY(0);
}

.list-type-thumbnail .post-item.protected .thum {
  float: right;
  width: 126px;
  height: 166px;
  margin-left: 57px;
  border: 1px solid #f1f1f1;
  background-color: #f8f8f8;
}

.list-type-thumbnail .post-item .title {
  max-width: 95%;
  margin-bottom: 12px;
  padding-top: 7px;
  font-size: 1.25em;
}

.list-type-thumbnail .post-item .excerpt {
  overflow: hidden;
  height: 3.75rem;
  margin-bottom: 20px;
  font-size: 0.875em;
  line-height: 1.25rem;
}

.list-type-thumbnail .post-item .meta .comment {
  display: none;
}

.list-type-thumbnail .post-item .meta span:before {
  content: none;
}

.list-type-text .post-header {
  margin-bottom: 38px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eee;
}

.list-type-text .post-header h1 {
  margin-bottom: 0;
}

.list-type-text .post-item {
  float: none;
  overflow: hidden;
  width: 100%;
  margin: 0 0 35px;
}

.list-type-text .post-item .thum {
  display: none;
}

.list-type-text .post-item .title {
  max-width: 96%;
  margin-bottom: 10px;
  padding-top: 0;
  font-size: 1em;
}

.list-type-text .post-item .excerpt {
  max-width: 96%;
  margin-bottom: 20px;
  font-size: 0.875em;
  line-height: 1.25rem;
}

.list-type-text .post-item .meta .comment {
  display: none;
}

.list-type-text .post-item .meta span:before {
  content: none;
}

.list-type-text .pagination {
  margin-top: 36px;
}

/* Retina Display */
@media only screen and (-webkit-min-device-pixel-ratio:1.5) {

  #header .util .search:before,
  #header .util .search button,
  #footer .page-top,
  .cover-thumbnail-3 button,
  .cover-thumbnail-4 button,
  .page-nav a strong:after,
  .entry-content .protected_form h2:before,
  .comment-list ul li .author-meta .control button,
  .comment-form .secret input[type=checkbox]:checked+label:before,
  .sidebar .social-channel ul li a,
  .sidebar .tab-ui h2 a:before {
    background-image: url(./images/ico_package_2x.png);
    background-size: 200px auto;
  }

  .post-item.protected .thum:before {
    background-image: url(./images/ico_package_2x.png);
    background-size: 120px auto;
  }
}

/* Media Screen */
@media screen and (max-width:1160px) {

  #header h1,
  #footer {
    padding-left: 24px;
    padding-right: 24px;
  }

  #header .util {
    right: 24px;
  }

  #header .util .profile nav {
    left: auto;
    right: 0;
    margin: 0;
  }

  #gnb ul {
    margin-left: -6px;
  }

  #container .content-wrap:before {
    left: 72.7%;
    margin-left: 0;
  }

  .layout-aside-left #container .content-wrap:before {
    left: 27.3%;
    margin-left: 0;
  }

  .main-slider .paging {
    left: auto;
    right: 20px;
    margin-left: 0;
  }

  .cover-event ul li .title {
    -webkit-line-clamp: 1;
  }

  .post-cover {
    padding-left: 24px;
    padding-right: 24px;
  }
}

@media screen and (max-width:767px) {
  #header h1 {
    position: relative;
    z-index: 10;
    padding: 24px;
    background-color: #fff;
  }

  #header .util {
    top: 0;
    right: 0;
    width: 100%;
    padding: 24px 68px 24px 24px;
    box-sizing: border-box;
  }

  #header .util .search {
    float: right;
  }

  #header .util .search.on {
    z-index: 20;
    width: 100%;
  }

  #header .util .search.on input {
    float: right;
    width: 100%;
  }

  #header .util .profile {
    display: none;
  }

  #header .util .menu {
    position: absolute;
    top: 24px;
    right: 24px;
    z-index: 300;
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 1px solid #eee;
    border-radius: 50%;
    text-indent: -999em;
    outline: none;
  }

  #header .util .menu span,
  #header .util .menu:before,
  #header .util .menu:after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 1px;
    margin: 0 0 0 -8px;
    background-color: #7f7f7f;
    transition: transform .5s;
    -webkit-transition: transform .5s;
  }

  #header .util .menu:before {
    margin-top: -6px;
  }

  #header .util .menu:after {
    margin-top: 6px;
  }

  #gnb {
    height: 69px;
  }

  #gnb ul {
    margin-left: 0;
  }

  #gnb ul li {
    padding: 0 24px;
  }

  #gnb ul li a {
    padding: 25px 0 24px;
  }

  #container .content-wrap {
    padding: 0;
  }

  #container .content-wrap:before {
    content: none;
  }

  #content {
    float: none;
    width: auto;
    padding: 34px 24px 40px;
  }

  #aside {
    position: fixed;
    top: 0;
    right: -278px;
    z-index: 400;
    float: none;
    overflow: auto;
    width: 278px;
    height: 100%;
    padding: 94px 24px 40px;
    background-color: #fff;
    box-sizing: border-box;
    transition: left .5s;
    -webkit-transition: right .5s;
  }

  #aside .close {
    position: absolute;
    top: 24px;
    right: 24px;
    z-index: 300;
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 1px solid #eee;
    border-radius: 50%;
    text-indent: -999em;
    outline: none;
  }

  #aside .close span {
    display: none;
  }

  #aside .close:before,
  #aside .close:after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 1px;
    margin: 0 0 0 -8px;
    background-color: #7f7f7f;
  }

  #aside .close:before {
    transform: rotate(-45deg);
  }

  #aside .close:after {
    transform: rotate(45deg);
  }

  #aside .profile {
    display: block;
    position: relative;
    margin-bottom: -40px;
  }

  #aside .profile:before {
    content: "";
    position: absolute;
    top: 0;
    left: -24px;
    z-index: 0;
    width: 100%;
    height: 100%;
    padding: 0 24px;
    background-color: #f5f5f5;
  }

  #aside .profile ul {
    position: relative;
    z-index: 10;
    text-align: center;
  }

  #aside .profile ul li {
    display: inline-block;
    padding: 16px 0 18px;
    font-size: 0.875em;
    color: #555;
    vertical-align: middle;
  }

  #aside .profile ul li a {
    display: inline-block;
    vertical-align: middle;
  }

  #aside .profile ul li:before {
    content: "";
    display: inline-block;
    width: 1px;
    height: 7px;
    margin: 0 20px 0 16px;
    background: url(./images/ico_package_2x.png) -100px -50px;
    background-size: 200px auto;
    vertical-align: middle;
  }

  #aside .profile ul li:first-child:before {
    content: none;
  }

  #footer {
    padding: 32px 24px 26px;
  }

  #footer p {
    margin-bottom: 11px;
    font-size: 0.8125em;
  }

  #footer .order-menu {
    margin-bottom: 29px;
  }

  #footer .order-menu a {
    display: block;
    margin-bottom: 0;
    line-height: 1.75rem;
  }

  #footer .order-menu a:before {
    content: none;
  }

  #tt-body-index #content {
    padding: 0;
  }

  #tt-body-index #content>.inner {
    padding: 0 24px;
  }

  #tt-body-index #content>.inner:first-child {
    padding-top: 40px;
  }

  #tt-body-index.list-type-text #content>.inner:first-child {
    padding-top: 36px;
  }

  #tt-body-index .pagination {
    margin: 0 20px 40px;
  }

  #tt-body-page #content {
    padding-left: 0;
    padding-right: 0;
  }

  #tt-body-tag .tags,
  #tt-body-guestbook #content {
    padding-left: 0;
    padding-right: 0;
  }

  #tt-body-guestbook .post-header {
    margin: 0 24px 28px;
  }

  .layout-aside-left #aside {
    padding: 80px 20px 40px;
  }

  .mobile-menu #aside {
    right: 0;
  }

  .main-slider ul li {
    height: 400px;
  }

  .main-slider ul li .inner {
    padding-bottom: 40px;
    vertical-align: bottom;
  }

  .main-slider ul li .text {
    max-width: 100%;
    font-weight: 300;
    font-size: 1.75em;
    line-height: 2.25rem;
    -webkit-line-clamp: 3;
  }

  .main-slider ul li .btn {
    margin-top: 15px;
  }

  .main-slider .paging {
    top: 40px;
    left: 0;
    right: auto;
    bottom: 20px;
    width: 100%;
    height: 8px;
    padding: 0 19px;
    text-align: left;
    box-sizing: border-box;
  }

  .main-slider .paging button {
    display: inline-block;
    margin: 0 5px;
    vertical-align: top;
  }

  .cover-thumbnail-1 {
    margin-bottom: 40px;
    padding: 36px 24px 7px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-thumbnail-1 h2 {
    font-weight: 600;
  }

  .cover-thumbnail-1 .more {
    top: 40px;
    right: 24px;
  }

  .cover-thumbnail-1 ul {
    display: block;
    width: 100%;
    margin-left: 0;
    margin-bottom: -39px;
  }

  .cover-thumbnail-1 ul li {
    float: none;
    width: 100%;
    margin-bottom: 30px;
    padding-left: 0;
  }

  .cover-thumbnail-1 ul li .title {
    margin-bottom: 4px;
  }

  .cover-thumbnail-2 {
    width: auto;
    margin: 0;
    padding: 37px 24px 38px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-thumbnail-2 h2 {
    font-weight: 600;
  }

  .cover-thumbnail-2 ul li figure {
    width: 98px;
    margin-left: 24px;
  }

  .cover-thumbnail-2 ul li .title {
    margin-bottom: 7px;
    padding-top: 3px;
    font-size: 1.125em;
  }

  .cover-thumbnail-2 ul li .excerpt {
    margin-bottom: 9px;
  }

  .cover-thumbnail-3 {
    width: auto;
    margin: 0;
    padding: 37px 24px 15px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-thumbnail-3 h2 {
    font-weight: 600;
  }

  .cover-thumbnail-3 .prev {
    top: 37px;
    right: 54px;
  }

  .cover-thumbnail-3 .next {
    top: 37px;
    right: 24px;
  }

  .cover-thumbnail-3 ul {
    display: block;
    width: auto;
    margin-left: -16px;
  }

  .cover-thumbnail-3 ul li {
    width: 50%;
    padding-left: 16px;
    box-sizing: border-box;
  }

  .cover-thumbnail-4 {
    width: auto;
    margin: 0;
    padding: 37px 24px 9px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-thumbnail-4 h2 {
    font-weight: 600;
  }

  .cover-thumbnail-4 .prev {
    top: 37px;
    right: 54px;
  }

  .cover-thumbnail-4 .next {
    top: 37px;
    right: 24px;
  }

  .cover-thumbnail-4 ul {
    width: 100%;
    margin-left: 0;
  }

  .cover-thumbnail-4 ul li {
    width: 100%;
    margin-bottom: 27px;
    padding-left: 0;
  }

  .cover-thumbnail-4 ul li figure {
    margin-bottom: 7px;
  }

  .cover-thumbnail-4 ul li .title {
    margin-bottom: 8px;
  }

  .cover-thumbnail-4 ul li .excerpt {
    margin-bottom: 12px;
  }

  .cover-list {
    width: auto;
    margin: 0;
    padding: 37px 24px 12px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-list h2 {
    margin-bottom: 28px;
    font-weight: 600;
  }

  .cover-list .more {
    top: 37px;
    right: 24px
  }

  .cover-list ul li {
    margin-bottom: 26px;
  }

  .cover-list ul li .title {
    margin-bottom: 8px;
    font-size: 1em;
  }

  .cover-list ul li .excerpt {
    margin-bottom: 9px;
    -webkit-line-clamp: 4;
  }

  .cover-event {
    width: auto;
    margin: 0;
    padding: 37px 24px 24px;
    border-top: 8px solid #f5f5f5;
  }

  .cover-event h2 {
    font-weight: 600;
  }

  .cover-event ul {
    display: block;
    width: auto;
    margin-left: 0;
  }

  .cover-event ul li {
    float: none;
    width: auto;
    margin-bottom: 16px;
    padding-left: 0;
  }

  .cover-event ul li a {
    padding-bottom: 43.382352941176471%;
  }

  .cover-event ul li .title {
    -webkit-line-clamp: 3;
  }

  .cover-event ul li .more {
    display: none;
  }

  .cover-thumbnail-1:first-child {
    border-top: 0;
  }

  .post-header {
    padding-top: 2px;
  }

  .post-item {
    float: none;
    ;
    width: auto;
    margin-left: 0;
    margin-bottom: 30px;
  }

  .post-item .thum {
    margin-bottom: 7px;
  }

  .post-item .title {
    margin-bottom: 12px;
  }

  .post-item .excerpt {
    margin-bottom: 12px;
  }

  .pagination {
    margin-bottom: 0;
  }

  .pagination a {
    margin: 0 5px;
  }

  .list-type-vertical .post-item {
    margin-bottom: 30px;
  }

  .list-type-vertical .post-item .title {
    margin-bottom: 7px;
  }

  .list-type-thumbnail .post-item .thum img {
    width: 96px;
    margin-left: 25px;
  }

  .list-type-thumbnail .post-item .title {
    margin-bottom: 9px;
    padding-top: 3px;
    font-size: 1.125em;
  }

  .list-type-thumbnail .post-item .excerpt {
    margin-bottom: 11px;
  }

  .list-type-thumbnail .post-item.protected .thum {
    width: 96px;
    height: 128px;
    margin-left: 25px;
  }

  .list-type-text .post-header {
    margin-bottom: 28px;
  }

  .list-type-text .post-item {
    margin-bottom: 26px;
  }

  .list-type-text .post-item .title {
    margin-bottom: 10px;
  }

  .list-type-text .post-item .excerpt {
    margin-bottom: 12px;
    -webkit-line-clamp: 4;
  }

  .list-type-text .pagination {
    margin-top: 30px;
  }

  .post-cover {
    padding-left: 24px;
    padding-right: 24px;
  }

  .post-cover .inner {
    padding-bottom: 38px;
    vertical-align: bottom;
  }

  .post-cover .inner>h1 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .post-cover .category {
    margin-bottom: 13px;
  }

  .post-cover h1 {
    font-weight: 500;
  }

  .post-cover .meta {
    margin-top: 23px 0 10px 0;
    font-size: 0.8125em;
  }

  .entry-content {
    padding: 0 24px;
  }

  .entry-content p {
    margin-bottom: 22px;
    line-height: 1.625rem;
  }

  .entry-content figure {
    margin-top: 6px !important;
  }

  .entry-content .protected_form input {
    width: 163px;
  }

  #content .another_category {
    margin: 40px 0 37px !important;
  }

  .container_postbtn {
    margin: 35px 0 37px;
  }

  .tags {
    margin-bottom: 25px;
    padding: 0 24px;
  }

  .tags h2 {
    margin-bottom: 19px;
  }

  .page-nav {
    margin: 32px 24px 32px;
    padding: 25px 0 25px;
  }

  .page-nav a {
    line-height: 1.6875rem;
  }

  .related-articles {
    margin-bottom: 21px;
    padding: 0 24px;
  }

  .related-articles h2 {
    margin-bottom: 19px;
  }

  .related-articles ul {
    width: 103.571428571428571%;
    margin-left: -3.571428571428571%;
  }

  .related-articles ul li {
    width: 50%;
    margin-bottom: 15px;
    padding-left: 3.448275862068966%;
  }

  .related-articles ul li figure {
    margin-bottom: 9px;
  }

  .related-articles ul li .title {
    height: 2.8em;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .comments {
    margin: 0;
  }

  .comments iframe {
    position: absolute;
    bottom: 0;
    left: 0;
  }

  .comments h2 {
    margin: -3px 0 -1px;
    padding: 0 24px;
  }

  .comment-list {
    margin-bottom: 32px;
    border: 0;
  }

  .comment-list>ul>.tt_more_preview_comments_wrap {
    margin-top: 21px;
    padding: 0 24px;
  }

  .comment-list ul li {
    padding: 34px 0 28px;
  }

  .comment-list ul li .author-meta {
    margin-bottom: 6px;
    padding-right: 35px;
  }

  .comment-list ul li .author-meta .avatar {
    width: 30px;
    height: 30px;
    margin-left: -42px;
  }

  .comment-list ul li .author-meta .nickname {
    font-weight: 400;
  }

  .comment-list ul li .author-meta .control {
    top: -2px;
    right: 13px;
  }

  .comment-list ul li .author-meta,
  .comment-list ul li p {
    max-width: none;
    padding: 0 66px;
  }

  .comment-list ul li ul {
    margin-top: 27px;
    padding: 19px 0 12px;
  }

  .comment-list ul li ul li {
    padding: 15px 0 16px;
  }

  .comment-list ul li ul li p {
    max-width: none;
  }

  .comment-list ul li ul li .author-meta {
    margin-bottom: 6px;
  }

  .comment-list ul li ul li .author-meta .avatar {
    width: 30px;
  }

  .comment-form {
    margin-bottom: 40px;
    padding: 0 24px;
  }

  .comment-form textarea {
    padding-right: 32px;
  }

  .comment-form .secret {
    left: 24px;
  }

  .layout-aside-left #content {
    float: none;
  }

  #tt-body-index.promotion-mobile-hide .main-slider {
    display: none;
  }

  #content .another_category th {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
}

@media screen and (max-width: 767px) {
  #tt-body-index .post-header {
    padding-top: 36px;
    padding-left: 24px;
  }
}

.revenue_unit_wrap.position_list {
  max-width: 740px;
  margin: 30px auto
}


.tt-comment-cont .tt-box-total .tt_txt_g {
  font-size: 14px;
}

.tt-comment-cont .tt-box-total .tt_num_g {
  font-size: 14px;
  color: #777;
}

.tt-comment-cont .tt-wrap-cmt .tt-link-user {
  font-size: 14px;
}

.tt-comment-cont .tt-wrap-cmt .tt_desc {
  font-size: 14px;
  color: #555;
}

.tt-comment-cont .tt-txt-mention {
  color: #555;
}

.tt-comment-cont .tt-btn_register {
  width: 100px;
  height: 36px;
  background-color: #333;
  font-size: 14px;
  color: #fff;
  border-radius: 0;
  border-color: #333;
}

.tt-comment-cont .tt-btn_register:hover {
  background-color: #04BEB8;
  border-color: #04BEB8;
}

.tt-comment-cont .tt-btn_register:focus {
  background-color: #04BEB8;
  border-color: #04BEB8;
}

.my_edit .ico_more {
  fill: rgb(0, 0, 0) !important;
}

@media screen and (max-width: 767px) {
  .tt-comments-wrap {
    padding: 0 24px;
  }
}

/* ?꾩껜 怨듯넻 */
#article-view {
  margin: 0;
  padding: 20px 20px 50px;
  word-wrap: break-word;
  color: #333;
  min-height: 370px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Apple SD Gothic Neo", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: 0;
}

.contents_style>* {
  margin: 20px 0 0 0;
}

/* ?띿뒪??愿??*/
#article-view h2[data-ke-size] {
  font-size: 1.62em;
  line-height: 1.46;
}

#article-view h3[data-ke-size] {
  font-size: 1.44em;
  line-height: 1.48;
}

#article-view h4[data-ke-size] {
  font-size: 1.25em;
  line-height: 1.55;
}

#article-view p[data-ke-size='size18'] {
  font-size: 1.12em;
  line-height: 1.67;
}

#article-view p[data-ke-size='size16'] {
  line-height: 1.75;
}

#article-view p[data-ke-size='size14'] {
  font-size: 0.87em;
  line-height: 1.71;
}

#article-view h2,
#article-view h3,
#article-view h4 {
  font-weight: normal;
  letter-spacing: -1px;
  color: #000;
  margin: 1em 0 20px;
}

#article-view p+p, #article-view p {
  margin-bottom: 30px;
}

#article-view h2+h2,
#article-view h3+h3,
#article-view h4+h4 {
  margin: 0;
}

#article-view h2+h3,
#article-view h2+h4,
#article-view h3+h4 {
  margin-top: 10px;
}

#article-view h2+p,
#article-view h3+p,
#article-view h4+p,
#article-view h5+p,
#article-view h6+p {
  margin-top: 10px;
}

#article-view div[data-ke-type='moreLess'] {
  caret-color: auto;
  background-color: #fafafa;
  padding: 20px 20px 22px;
  margin: 20px 0;
  border: 1px dashed #dddddd;
  color: #333333;
}

#article-view a {
  color: #0070d1;
  text-decoration: underline;
}

#article-view figure[data-ke-type='contentSearch'] a {
  text-decoration: none;
}

/* ?몄슜臾?*/
#article-view blockquote[data-ke-style='style1'] {
  text-align: center;
  background: url(https://t1.daumcdn.net/keditor/dist/0.7.21/image/blockquote-style1.svg) no-repeat 50% 0;
  padding: 34px 0 0 0;
  font-size: 1.12em;
  color: #333;
  line-height: 1.67;
  border: 0 none;
  font-family: "Noto Serif KR";
}

#article-view blockquote[data-ke-style='style2'] {
  border-color: #d0d0d0;
  border-width: 0 0 0 4px;
  border-style: solid;
  padding: 1px 0 0 12px;
  color: #666;
  line-height: 1.75;
  font-size: 1em;
  text-align: left;
}

#article-view blockquote[data-ke-style='style3'] {
  border: 1px solid #dddddd;
  background-color: #fcfcfc;
  text-align: left;
  padding: 21px 25px 20px 25px;
  color: #666;
  font-size: 1em;
  line-height: 1.75;
}

#article-view blockquote {
  display: block;
  margin: 20px auto 0;
  letter-spacing: 0px;
}

/* 泥⑤?: 怨듯넻 */

/* ?대?吏 ?대┃ 愿??- lightbox */
#article-view span[data-lightbox] {
  cursor: pointer;
}

/* 泥⑤?: ?뚯씪 */
#article-view figure.fileblock {
  width: 470px;
  height: 73px;
  box-sizing: border-box;
  position: relative;
  border-radius: 1px;
  margin-top: 20px;
  margin-bottom: 0px;
  box-shadow: 0 1px 4px 0 rgb(0 0 0 / 7%);
  border: solid 1px rgba(0, 0, 0, 0.1);
}

#article-view figure.fileblock a {
  display: block;
}

#article-view figure.fileblock .image {
  float: left;
  width: 30px;
  height: 30px;
  background-image: url('https://t1.daumcdn.net/tistory_admin/static/manage/post-editor/img_editor_content.svg');
  margin: 22px 17px 21px 22px;
  background-position: 0 0;
}

#article-view figure.fileblock .desc {
  position: absolute;
  left: 70px;
  right: 60px;
  top: 4px;
  bottom: 0;
}

#article-view figure.fileblock .filename {
  color: #333333;
  font-size: 14px;
  text-overflow: ellipsis;
  width: 100%;
  height: 20px;
  margin: 16px 0 0;
}

#article-view figure.fileblock .size {
  font-family: Pretendard-Regular;
  font-size: 12px;
  color: #777;
  height: 16px;
}

#article-view figure[data-ke-align=alignCenter].fileblock {
  margin-left: auto;
  margin-right: auto;
}

#article-view figure[data-ke-align=alignRight].fileblock {
  margin-left: auto;
}

#article-view figure.fileblock .name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 272px;
  height: 20px;
  display: block;
}

#article-view figure.fileblock a::after {
  content: '';
  background-image: url('https://t1.daumcdn.net/tistory_admin/static/manage/post-editor/img_editor_content.svg');
  background-position: -40px 0;
  width: 30px;
  height: 30px;
  position: absolute;
  right: 24px;
  top: 19px;
}

/* 泥⑤?: ?대?吏 */
#article-view figure.imageblock {
  display: table;
  position: relative;
}

#article-view figure.imageblock.alignLeft {
  text-align: left;
}

#article-view figure.imageblock.alignCenter {
  margin: 20px auto 0;
  text-align: center;
}

#article-view figure.imageblock.alignRight {
  text-align: right;
  margin-left: auto;
}

#article-view figure.imageblock.floatLeft {
  float: left;
  margin-right: 20px;
}

#article-view figure.imageblock.floatRight {
  float: right;
  margin-left: 20px;
}

#article-view figure.imageblock.widthContent {
  display: block;
}

#article-view figure.imageblock.widthContent img {
  width: 100%;
}

#article-view figure.imageblock.floatLeft figcaption,
#article-view figure.imageblock.floatRight figcaption {
  text-align: left;
}

#article-view figure.imageblock img {
  display: inline-block;
  max-width: 100%;
  margin: 0;
  height: auto;
}

#article-view iframe,
#article-view figure img,
#article-view figure iframe {
  max-width: 100%;
}

#article-view figure img:not([width]),
#article-view figure iframe:not([width]) {
  width: 100%;
}

#article-view figure {
  max-width: 100%;
  clear: both;
}

#article-view figure img {
  display: inline-block;
}

#article-view figure.imagegridblock+figure.imagegridblock,
#article-view figure.imagegridblock+figure.imageblock,
#article-view figure.imageblock+figure.imagegridblock {
  margin-top: 10px;
}

/* 罹≪뀡 ?띿뒪??*/
#article-view figure figcaption {
  font-size: 13px;
  color: #777;
  word-break: break-word;
  padding-top: 10px;
  min-height: 20px;
  caption-side: bottom;
  text-align: center;
  caret-color: auto;
  width: 100%;
  box-sizing: content-box;
}

/* 泥⑤?: ?대?吏 洹몃━??*/
#article-view figure.imagegridblock {
  position: relative;
  caret-color: transparent;
  background-color: transparent;
  width: 100%;
  height: auto;
  margin: 20px 0 0 0;
}

#article-view figure.imagegridblock .image-container {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
}

#article-view figure.imagegridblock .image-container>span {
  margin-right: 0;
  margin-top: 2px;
}

#article-view figure.imagegridblock img {
  margin: 0;
  height: inherit;
}

#article-view figure.imagegridblock span img {
  width: 100%;
}

hr[data-ke-style],
#article-view hr[data-ke-style] {
  border: none;
  font-size: 0;
  line-height: 0;
  margin: 20px auto;
  background: url(https://t1.daumcdn.net/keditor/dist/0.7.21/image/divider-line.svg);
  background-size: 200px 420px;
  cursor: default !important;
}

hr[data-ke-style='style1'],
#article-view hr[data-ke-style='style1'] {
  background-position: center 0;
  width: 64px;
  height: 4px;
  padding: 20px;
}

hr[data-ke-style='style2'],
#article-view hr[data-ke-style='style2'] {
  background-position: center -48px;
  width: 64px;
  height: 3px;
  padding: 20px;
}

hr[data-ke-style='style3'],
#article-view hr[data-ke-style='style3'] {
  background-position: center -96px;
  width: 64px;
  height: 8px;
  padding: 18px 20px;
}

hr[data-ke-style='style4'],
#article-view hr[data-ke-style='style4'] {
  background-position: center -144px;
  width: 2px;
  height: 60px;
  padding: 0 51px;

}

hr[data-ke-style='style4']+hr[data-ke-style='style4'],
#article-view hr[data-ke-style='style4']+hr[data-ke-style='style4'] {
  margin-top: 0;
}

hr[data-ke-style='style5'],
#article-view hr[data-ke-style='style5'] {
  background-position: center -208px;
  background-repeat: repeat-x;
  height: 2px;
  padding: 21px 0;
}

hr[data-ke-style='style6'],
#article-view hr[data-ke-style='style6'] {
  background-position: center -256px;
  background-repeat: repeat-x;
  height: 2px;
  padding: 21px 0;
}

hr[data-ke-style='style7'],
#article-view hr[data-ke-style='style7'] {
  background-position: center -304px;
  width: 200px;
  height: 19px;
  padding: 18px 20px 17px 20px;
}

hr[data-ke-style='style8'],
#article-view hr[data-ke-style='style8'] {
  background-position: center -362px;
  width: 200px;
  height: 19px;
  padding: 18px 20px 17px 20px;
}

/* ?뚯씠釉?*/
#article-view table[data-ke-style] {
  margin-bottom: 0px;
}

#article-view table {
  border-color: #ddd;
  margin-bottom: 0px;
}

#article-view table tbody tr {
  box-sizing: content-box;
}

#article-view table td {
  word-break: break-word;
  padding: 8px;
  font-size: 15px;
}

#article-view table[data-ke-style='style1'] tr:first-child td {
  border-bottom: 1px solid #6ed3d8;
}

#article-view table[data-ke-style='style2'] tr:first-child td {
  border-bottom: 1px solid #008300;
}

#article-view table[data-ke-style='style3'] tr:first-child td {
  border-bottom: 1px solid #006dbe;
}

#article-view table[data-ke-style='style4'] tr:nth-child(2n) td {
  background-color: #f9f9f9;
}

#article-view table[data-ke-style='style5'] tr:nth-child(2n) td {
  background-color: #f8fbfb;
}

#article-view table[data-ke-style='style6'] tr:nth-child(2n) td {
  background-color: #f5f7f5;
}

#article-view table[data-ke-style='style7'] tr:nth-child(2n) td {
  background-color: #f6f8fb;
}

#article-view table[data-ke-style='style8'] tr:first-child td {
  border-bottom: 2px solid #797979;
}

#article-view table[data-ke-style='style8'] {
  border-left: 0 none;
  border-right: 0 none;
}

#article-view table[data-ke-style='style8'] td {
  border-right-color: transparent;
  border-left-color: transparent;
}

#article-view table[data-ke-style='style9'] tr:first-child td {
  border-bottom: 2px solid #6ed3d8;
}

#article-view table[data-ke-style='style9'] {
  border-left: 0 none;
  border-right: 0 none;
}

#article-view table[data-ke-style='style9'] td {
  border-right-color: transparent;
  border-left-color: transparent;
}

#article-view table[data-ke-style='style10'] tr:first-child td {
  border-bottom: 2px solid #008300;
}

#article-view table[data-ke-style='style10'] {
  border-left: 0 none;
  border-right: 0 none;
}

#article-view table[data-ke-style='style10'] td {
  border-right-color: transparent;
  border-left-color: transparent;
}

#article-view table[data-ke-style='style11'] tr:first-child td {
  border-bottom: 2px solid #2780d4;
}

#article-view table[data-ke-style='style11'] {
  border-left: 0 none;
  border-right: 0 none;
}

#article-view table[data-ke-style='style11'] td {
  border-right-color: transparent;
  border-left-color: transparent;
}

#article-view table[data-ke-style='style12'] tr:nth-child(odd) td {
  background-color: #f9f9f9;
}

#article-view table[data-ke-style='style12'] tr td:first-child {
  background-color: #efefef;
}

#article-view table[data-ke-style='style12'] tr:first-child td {
  background-color: #9b9b9b;
  border: 1px solid #888;
  color: #fff;
}

#article-view table[data-ke-style='style13'] tr:nth-child(odd) td {
  background-color: #f9f9f9;
}

#article-view table[data-ke-style='style13'] tr td:first-child {
  background-color: #efefef;
}

#article-view table[data-ke-style='style13'] tr:first-child td {
  background-color: #6ed3d8;
  border: 1px solid #5cbcc1;
  color: #fff;
}

#article-view table[data-ke-style='style14'] tr:nth-child(odd) td {
  background-color: #f9f9f9;
}

#article-view table[data-ke-style='style14'] tr td:first-child {
  background-color: #efefef;
}

#article-view table[data-ke-style='style14'] tr:first-child td {
  background-color: #008300;
  border: 1px solid #006d00;
  color: #fff;
}

#article-view table[data-ke-style='style15'] tr:nth-child(odd) td {
  background-color: #f9f9f9;
}

#article-view table[data-ke-style='style15'] tr td:first-child {
  background-color: #efefef;
}

#article-view table[data-ke-style='style15'] tr:first-child td {
  background-color: #2780d4;
  border: 1px solid #1568b7;
  color: #fff;
}

#article-view table[data-ke-style='style16'],
#article-view table[data-ke-style='style16'] tr,
#article-view table[data-ke-style='style16'] tr td {
  border-color: transparent;
}

/* ?ㅽ뵂 洹몃옒??*/
#article-view figure[data-ke-type='opengraph'] {
  margin: 10px 0;
}

#article-view figure[data-ke-type='opengraph'] a {
  box-sizing: initial;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.07);
  border: solid 1px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  color: #000;
}

#article-view figure[data-ke-type='opengraph'] a:hover {
  opacity: 1;
}

#article-view figure[data-ke-type='opengraph'] div.og-image {
  border-right: solid 1px rgba(0, 0, 0, 0.06);
  width: 200px;
  height: 200px;
  background-size: cover;
  background-position: center;
}

#article-view figure[data-ke-type='opengraph'] div.og-image button {
  display: none;
}

#article-view figure[data-ke-type='opengraph']:hover div.og-image button {
  cursor: pointer;
  border: none;
  display: block;
  position: absolute;
  top: 0px;
  right: 0px;
  background-color: #000;
  width: 15px;
  height: 15px;
}

#article-view figure[data-ke-type='opengraph'] p.og-title {
  color: #000000;
  font-size: 22px;
  padding-bottom: 10px;
  max-width: 467px;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0px;
  overflow: hidden;
  font-family: Pretendard-Regular;
}

#article-view figure[data-ke-type='opengraph'] .og-desc {
  margin: 0px;
  max-width: 467px;
  text-overflow: ellipsis;
  overflow: hidden;
  font-family: Pretendard-Regular;
  font-size: 14px;
  font-weight: 300;
  font-style: normal;
  font-stretch: normal;
  line-height: normal;
  letter-spacing: normal;
  color: #909090;
  max-height: 42px;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  display: -webkit-box;
}

@media (max-width: 600px) {
  #article-view figure[data-ke-type='opengraph'] a {
    height: 90px;
  }

  #article-view figure[data-ke-type='opengraph'] a::before {
    left: 44px;
  }

  #article-view figure[data-ke-type='opengraph'] div.og-image {
    width: 90px;
    height: 90px;
  }

  #article-view figure[data-ke-type='opengraph'] div.og-text {
    padding: 13px 12px 0 20px;
    height: 90px;
  }

  #article-view figure[data-ke-type='opengraph'] div.og-text p.og-title {
    font-size: 16px;
    -webkit-line-clamp: 1;
  }

  #article-view figure[data-ke-type='opengraph'] div.og-text p.og-desc {
    display: none;
  }

  #article-view figure[data-ke-type='opengraph'] div.og-text p.og-host {
    bottom: 10px;
  }
}

/* 鍮꾨뵒??泥⑤? */
#article-view figure[data-ke-type='video'] {
  display: block;
  table-layout: fixed;
  justify-content: center;
  align-items: center;
  position: relative;
  text-align: center;
  color: #bdbdbd;
  font-size: 16px;
  line-height: 30px;
}

#article-view figure[data-ke-type='video'][data-ke-style='alignLeft'] {
  text-align: left;
}

#article-view figure[data-ke-type='video'][data-ke-style='alignCenter'] {
  margin: 20px auto 0;
  text-align: center;
}

#article-view figure[data-ke-type='video'][data-ke-style='alignRight'] {
  text-align: right;
  margin-left: auto;
}

#article-view figure[data-ke-type='video'] img {
  display: block;
  max-width: 100%;
  margin: 0 auto;
}

#article-view figure[data-ke-type='video'][data-video-host] iframe {
  margin: 0px;
  display: block;
}

#article-view figure[data-ke-type='video']>iframe[width='0'][height='0'] {
  width: 860px;
  height: 484px;
  max-width: 100%;
}

/* 肄붾뱶 釉붾윮 */
#article-view pre code.hljs {
  font-size: 14px;
  padding: 20px;
  font-family: SF Mono, Menlo, Consolas, Monaco, monospace;
  border: solid 1px #ebebeb;
  line-height: 1.71;
  overflow: auto;
}

/* ?묒? 湲 */
#article-view .moreless-content :first-child {
  margin-top: 0;
  margin-bottom: 0;
}

#article-view div[data-ke-type='moreLess'] .moreless-content {
  display: none;
}

#article-view div[data-ke-type='moreLess'].open .moreless-content {
  display: block;
}

#article-view div[data-ke-type='moreLess'] .btn-toggle-moreless {
  color: #909090;
  font-size: 16px;
  line-height: 26px;
  font-family: Pretendard-Regular, sans-serif;
  cursor: pointer;
  text-decoration: none;
}

/* 由ъ뒪??*/
#article-view ul li,
#article-view ol li {
  margin: 0 0 3px 22px;
  line-height: 1.7;
}

#article-view ul,
#article-view ol {
  margin: 14px auto 24px;
  padding: 0 0 0 10px;
}

/* ?대え?곗퐯 */
#article-view figure[data-ke-type=emoticon][data-ke-align=alignCenter] {
  text-align: center;
}

#article-view figure[data-ke-type=emoticon][data-ke-align=alignLeft] {
  text-align: left;
}

#article-view figure[data-ke-type=emoticon][data-ke-align=alignRight] {
  text-align: right;
}

/* 吏??*/
#article-view figure[data-ke-type='map'],
#article-view iframe[data-ke-type='map'] {
  display: block;
  margin: 0 auto;
}

/* 泥⑤?: ?대?吏 ?щ씪?대뱶 */
#article-view figure.imageslideblock {
  clear: both;
  position: relative;
  font-size: 0;
  outline: 0 none;
}

#article-view figure.imageslideblock .btn {
  display: none;
  outline: none;
}

#article-view figure.imageslideblock.ready .btn {
  display: inline-block;
}

#article-view figure.imageslideblock.ready .mark {
  opacity: 1;
}

#article-view figure.imageslideblock div.image-container {
  position: relative;
  min-width: 480px;
  max-width: 100%;
  min-height: 300px;
  max-height: 860px;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0 auto;
}

#article-view figure.imageslideblock div.image-container span.image-wrap {
  display: none;
}

#article-view figure.imageslideblock div.image-container span.image-wrap.selected {
  display: inline;
}

#article-view figure.imageslideblock div.image-container img {
  max-width: 100%;
  max-height: 100%;
}

#article-view figure.imageslideblock div.image-container .btn {
  position: absolute;
  border: 0;
  background: transparent;
  width: 60px;
  height: 60px;
  top: 50%;
  margin-top: -20px;
}

#article-view figure.imageslideblock div.image-container .btn-prev {
  left: 0;
}

#article-view figure.imageslideblock div.image-container .btn-next {
  right: 0;
}

#article-view figure.imageslideblock div.image-container:hover .btn span {
  opacity: 0.3;
}

#article-view figure.imageslideblock div.image-container .btn span {
  background-image: url('https://t1.daumcdn.net/tistory_admin/static/manage/post-editor/img_editor_content.svg');
  text-indent: -10000px;
  overflow: hidden;
  width: 40px;
  height: 40px;
  opacity: 0;
  transition: opacity ease-in-out 0.2s;
  display: inline-block;
}

#article-view figure.imageslideblock div.image-container .btn:hover span {
  opacity: 1;
}

#article-view figure.imageslideblock div.image-container .btn .ico-prev {
  background-position: -220px 0;
}

#article-view figure.imageslideblock div.image-container .btn .ico-next {
  background-position: -260px 0;
}

#article-view figure.imageslideblock div.mark {
  display: block;
  height: 44px;
  text-align: center;
  opacity: 0;
  transition: opacity ease-in-out 0.2s;
}

#article-view figure.imageslideblock div.mark span {
  width: 30px;
  height: 4px;
  display: inline-block;
  margin: 20px 1px;
  background-color: #d6d6d6;
  text-indent: -10000px;
  overflow: hidden;
  cursor: pointer;
}

#article-view figure.imageslideblock div.mark span:first-child {
  background-color: #000;
  margin-left: 0;
}

#article-view figure.imageslideblock div.mark span:last-child {
  margin-right: 0;
}

#article-view figure.imageslideblock figcaption {
  text-align: center;
  color: #666;
  font-size: 14px;
}

#article-view figure.imageslideblock.alignLeft {
  text-align: left;
}

#article-view figure.imageslideblock.alignCenter {
  margin: 0 auto 20px;
  text-align: center;
}

#article-view figure.imageslideblock.alignRight {
  text-align: right;
  margin-left: auto;
}

@media (max-width: 600px) {
  #article-view figure.imageslideblock div.image-container {
    min-width: 100%;
    width: 100%;
    max-height: 100%;
  }

  #article-view figure.imageslideblock div.image-container .btn span {
    opacity: 0.3;
  }
}

/* 援??먮뵒???띿꽦 */
.btn_more, .btn_less {
  border: 0;
  background: transparent;
  display: block;
  height: 21px;
  margin: 20px 0;
  font-size: 14px;
  line-height: 14px;
  color: #888;
  position: relative;
  width: 100%;
  text-align: left;
}

.btn_less::before,
.btn_more::before {
  content: "...";
  display: inline-block;
  padding-right: 5px;
  font-size: 14px;
  line-height: 6px;
  vertical-align: top;
}

.box-timeline-content {
  word-break: break-all;
}

/* =========================================================================
 * UPGRADE PACK  (v1.0)
 * ?먮낯 ?ㅽ궓 CSS ?ㅼ뿉 ?㏓텤???뺤옣 ?덉씠??
 * - ?먮낯 洹쒖튃??吏?곗? ?딄퀬 '?ㅼ뿉????뼱?곕뒗' 諛⑹떇?대씪 ?섎룎由ш린媛 ?쎈떎.
 *   (??二쇱꽍 ?꾨옒 ?꾩껜瑜???젣?섎㈃ ?먮낯 ?곹깭濡??꾩쟾 蹂듦?)
 *
 * CONTENTS
 *   A. ?붿옄???좏겙 & 湲곕낯 蹂댁젙
 *   B. ?ㅽ겕 紐⑤뱶
 *   C. ?ㅻ뜑 / ?대퉬寃뚯씠?? *   D. ?쎄린 吏꾪뻾瑜?쨌 ?뚮줈??踰꾪듉 쨌 ?좎뒪?? *   E. 紐⑹감(TOC) 쨌 紐⑤컮???쒗듃
 *   F. ?쎄린 ?꾧뎄(?쎈뒗 ?쒓컙 쨌 湲???ш린)
 *   G. 蹂몃Ц ??댄룷 & ?붿냼 (??肄붾뱶/?대?吏/留곹겕)
 *   H. ?앹꽦湲??몃씪???ㅽ???????ㅽ겕 紐⑤뱶 媛?낆꽦)
 *   I. ?좊뱶?쇱뒪 愿묎퀬 ?곸뿭
 *   J. 怨듭쑀 踰꾪듉
 *   K. 紐⑸줉/移대뱶/?쒓렇/?섏씠吏?留덉씠?щ줈 ?명꽣?숈뀡
 *   L. ?ъ씠?쒕컮 쨌 ?볤? 쨌 ?명꽣
 *   M. ?묎렐??쨌 紐⑥뀡 쨌 ?몄뇙
 * ========================================================================= */

/* ---------------------------------------------------------------
 * A. ?붿옄???좏겙 & 湲곕낯 蹂댁젙
 * --------------------------------------------------------------- */
:root {
  --sk-accent: #4c1d95;
  /* 蹂몃Ц 諛뺤뒪(#4c1d95)? ?ㅼ쓣 留욎텣 ?ъ씤????*/
  --sk-accent-soft: rgba(76, 29, 149, 0.08);
  --sk-accent-line: rgba(76, 29, 149, 0.28);

  --sk-bg: #ffffff;
  --sk-surface: #ffffff;
  --sk-surface-2: #f7f8fa;
  --sk-border: #ebecef;
  --sk-border-strong: #d8dade;

  --sk-text: #333333;
  --sk-text-strong: #111111;
  --sk-muted: #8b8f96;

  --sk-radius: 12px;
  --sk-radius-lg: 16px;
  --sk-shadow-1: 0 1px 2px rgba(16, 24, 40, .05), 0 1px 3px rgba(16, 24, 40, .06);
  --sk-shadow-2: 0 6px 16px rgba(16, 24, 40, .10), 0 2px 6px rgba(16, 24, 40, .06);
  --sk-ease: cubic-bezier(.2, .7, .2, 1);
  --sk-header-h: 96px;
}

/* hidden ?띿꽦? ?대뼡 display ?좎뼵蹂대떎 ?곗꽑?댁빞 ?쒕떎 (JS 濡?耳쒓퀬 ?꾨뒗 ?붿냼?ㅼ쓽 湲곕낯媛? */
[hidden] {
  display: none !important;
}

/* ?덈줈 異붽???而댄룷?뚰듃?먮쭔 border-box ?곸슜.
   ?꾩뿭(*)???곸슜?섎㈃ ?먮낯 ?덉씠?꾩썐 怨꾩궛???닿툔?????덉뼱 ?쇰???踰붿쐞瑜?醫곹삍?? */
[class^="sk-"],
[class*=" sk-"] {
  box-sizing: border-box;
}

html {
  scroll-padding-top: 124px;
  /* ?ㅽ떚???ㅻ뜑???쒕ぉ??媛?ㅼ?吏 ?딄쾶 */
  -webkit-tap-highlight-color: rgba(76, 29, 149, .12);
}

@media (max-width: 767px) {
  html {
    scroll-padding-top: 20px;
    /* 紐⑤컮?쇱? ?ㅻ뜑媛 怨좎젙?섏? ?딅뒗??*/
  }
}

@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

body {
  background-color: var(--sk-bg);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ?쒓뎅???⑥뼱 以묎컙 以꾨컮轅?諛⑹? ???쒕ぉ/?붿빟 ??瑗??꾩슂??怨노쭔 */
.post-cover h1,
.post-item .excerpt,
.entry-content h1,
.entry-content h2,
.entry-content h3,
.entry-content h4,
.entry-content li,
.sk-toc__item a,
.sk-tools__info {
  word-break: keep-all;
  overflow-wrap: break-word;
}

img {
  max-width: 100%;
}

::selection {
  background: var(--sk-accent-soft);
  color: var(--sk-text-strong);
}

/* ?ㅽ겕由곕━???꾩슜 ?띿뒪?????먮낯 CSS ???뺤쓽媛 ?놁뼱 蹂닿컯 */
.screen_out,
.sk-sr-only {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ?뉕퀬 議곗슜???ㅽ겕濡ㅻ컮 (?곗뒪?ы넲) */
@media (min-width: 1025px) {

  .sk-toc--rail,
  .sk-tablewrap {
    scrollbar-width: thin;
    scrollbar-color: var(--sk-border-strong) transparent;
  }

  .sk-toc--rail::-webkit-scrollbar,
  .sk-tablewrap::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .sk-toc--rail::-webkit-scrollbar-thumb,
  .sk-tablewrap::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 8px;
    background-clip: content-box;
    background-color: var(--sk-border-strong);
  }
}

/* ---------------------------------------------------------------
 * B. ?ㅽ겕 紐⑤뱶
 *    - ?먮낯? ?됱쓣 ?섎뱶肄붾뵫?덇린 ?뚮Ц??釉붾줉蹂꾨줈 ?뺥솗????뼱?대떎.
 * --------------------------------------------------------------- */
html[data-theme="dark"] {
  --sk-accent: #a78bfa;
  --sk-accent-soft: rgba(167, 139, 250, .14);
  --sk-accent-line: rgba(167, 139, 250, .38);

  --sk-bg: #15171b;
  --sk-surface: #1b1e23;
  --sk-surface-2: #21252b;
  --sk-border: #2b2f36;
  --sk-border-strong: #3a3f47;

  --sk-text: #d6d9de;
  --sk-text-strong: #f2f4f7;
  --sk-muted: #9aa0a8;

  --sk-shadow-1: 0 1px 2px rgba(0, 0, 0, .40);
  --sk-shadow-2: 0 8px 24px rgba(0, 0, 0, .50);
  color-scheme: dark;
}

html[data-theme="dark"] body {
  background-color: var(--sk-bg);
  color: var(--sk-text);
}

/* ?ㅻ뜑 쨌 ?대퉬 */
html[data-theme="dark"] #header {
  background-color: var(--sk-bg);
  border-bottom-color: var(--sk-border);
}

html[data-theme="dark"] #header h1,
html[data-theme="dark"] #header h1 a {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] #header .util .search,
html[data-theme="dark"] #header .util .search.on input {
  background-color: var(--sk-surface-2);
  border-color: var(--sk-border);
  color: var(--sk-text);
}

html[data-theme="dark"] #header .util .search input {
  color: var(--sk-text);
}

html[data-theme="dark"] #header .util .search input::placeholder {
  color: var(--sk-muted);
}

html[data-theme="dark"] #header .util .profile button,
html[data-theme="dark"] #header .util .menu,
html[data-theme="dark"] #aside .close {
  border-color: var(--sk-border);
}

html[data-theme="dark"] #header .util .profile ul li a {
  background-color: var(--sk-surface);
  border-color: var(--sk-border);
  color: var(--sk-text);
}

html[data-theme="dark"] #header .util .profile ul li a:hover,
html[data-theme="dark"] #header .util .profile ul li a:focus {
  background-color: var(--sk-surface-2);
  color: var(--sk-text-strong);
}

html[data-theme="dark"] #header .util .menu span,
html[data-theme="dark"] #header .util .menu:before,
html[data-theme="dark"] #header .util .menu:after,
html[data-theme="dark"] #aside .close:before,
html[data-theme="dark"] #aside .close:after {
  background-color: #b9bec6;
}

html[data-theme="dark"] #gnb ul li a {
  color: var(--sk-muted);
}

html[data-theme="dark"] #gnb ul li a:hover,
html[data-theme="dark"] #gnb ul li.current a {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] #gnb ul li.current a:after,
html[data-theme="dark"] #gnb ul li a:hover:after,
html[data-theme="dark"] #gnb ul li a:focus:after {
  background-color: var(--sk-accent);
}

/* ?덉씠?꾩썐 援щ텇??*/
html[data-theme="dark"] #container .content-wrap:before,
html[data-theme="dark"] #footer,
html[data-theme="dark"] .page-nav,
html[data-theme="dark"] .comment-list,
html[data-theme="dark"] .comment-list ul li {
  border-color: var(--sk-border);
}

html[data-theme="dark"] #container .content-wrap:before {
  background-color: var(--sk-border);
}

/* 湲 ?ㅻ뜑 */
html[data-theme="dark"] .post-cover h1,
html[data-theme="dark"] .post-cover h1 a,
html[data-theme="dark"] #tt-body-index .post-cover.notice h1,
html[data-theme="dark"] #tt-body-index .post-cover.notice h1 a {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .post-cover .category {
  color: var(--sk-accent);
}

html[data-theme="dark"] .post-cover .meta {
  border-bottom-color: var(--sk-border);
  color: var(--sk-muted);
}

html[data-theme="dark"] .post-cover .meta span:before {
  background-color: var(--sk-border-strong);
}

html[data-theme="dark"] .post-cover .meta a {
  color: var(--sk-accent);
}

/* 紐⑸줉 移대뱶 */
html[data-theme="dark"] .post-item .title,
html[data-theme="dark"] .cover-thumbnail-1 ul li .title,
html[data-theme="dark"] .cover-thumbnail-2 ul li .title,
html[data-theme="dark"] .cover-thumbnail-3 ul li .title,
html[data-theme="dark"] .cover-thumbnail-4 ul li .title,
html[data-theme="dark"] .cover-list ul li .title,
html[data-theme="dark"] .post-header h1 {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .post-item a,
html[data-theme="dark"] .cover-thumbnail-1 ul li a,
html[data-theme="dark"] .cover-thumbnail-2 ul li a,
html[data-theme="dark"] .cover-thumbnail-3 ul li a,
html[data-theme="dark"] .cover-thumbnail-4 ul li a,
html[data-theme="dark"] .cover-list ul li a,
html[data-theme="dark"] .related-articles ul li a {
  color: var(--sk-text);
}

html[data-theme="dark"] .post-item .thum,
html[data-theme="dark"] .cover-thumbnail-1 ul li figure,
html[data-theme="dark"] .cover-thumbnail-2 ul li figure,
html[data-theme="dark"] .cover-thumbnail-3 ul li figure,
html[data-theme="dark"] .cover-thumbnail-4 ul li figure,
html[data-theme="dark"] .related-articles ul li figure {
  background-color: var(--sk-surface-2);
}

html[data-theme="dark"] .cover-thumbnail-2 ul li figure img,
html[data-theme="dark"] .cover-thumbnail-3 ul li figure img,
html[data-theme="dark"] .list-type-thumbnail .post-item .thum img {
  border-color: var(--sk-border);
}

html[data-theme="dark"] .cover-thumbnail-2 h2,
html[data-theme="dark"] .cover-list h2,
html[data-theme="dark"] .list-type-thumbnail .post-header,
html[data-theme="dark"] .list-type-text .post-header {
  border-bottom-color: var(--sk-border);
}

html[data-theme="dark"] .cover-thumbnail-1 h2,
html[data-theme="dark"] .cover-thumbnail-2 h2,
html[data-theme="dark"] .cover-thumbnail-3 h2,
html[data-theme="dark"] .cover-thumbnail-4 h2,
html[data-theme="dark"] .cover-list h2,
html[data-theme="dark"] .cover-event h2,
html[data-theme="dark"] .tags h2,
html[data-theme="dark"] .related-articles h2,
html[data-theme="dark"] .comments h2,
html[data-theme="dark"] .sidebar h2 {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .cover-thumbnail-2 .more,
html[data-theme="dark"] .comment-list .tt_more_preview_comments_text,
html[data-theme="dark"] .pagination .view-more {
  border-color: var(--sk-border);
  color: var(--sk-muted);
}

/* ?쒓렇 쨌 ?섏씠吏?쨌 踰꾪듉 */
html[data-theme="dark"] .tags a {
  border-color: var(--sk-border);
  background-color: var(--sk-surface);
  color: var(--sk-text);
}

html[data-theme="dark"] .tags a:hover,
html[data-theme="dark"] .tags a:focus {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .pagination a {
  color: var(--sk-muted);
}

html[data-theme="dark"] .pagination .selected {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .pagination .prev,
html[data-theme="dark"] .pagination .next,
html[data-theme="dark"] .cover-thumbnail-3 button,
html[data-theme="dark"] .cover-thumbnail-4 button {
  border-color: var(--sk-border);
}

html[data-theme="dark"] .btn,
html[data-theme="dark"] a.btn {
  background-color: #3a3f47;
  color: #f2f4f7;
}

html[data-theme="dark"] .btn:hover {
  background-color: var(--sk-accent);
}

/* ?ㅽ봽?쇱씠???꾩씠肄? 諛앹? 諛곌꼍 + 吏숈? ?꾩씠肄???諛섏쟾?댁꽌 ?ㅽ겕??留욎텣??*/
html[data-theme="dark"] #header .util .search:before,
html[data-theme="dark"] #header .util .search button,
html[data-theme="dark"] #footer .page-top,
html[data-theme="dark"] .cover-thumbnail-3 button,
html[data-theme="dark"] .cover-thumbnail-4 button,
html[data-theme="dark"] .pagination .prev,
html[data-theme="dark"] .pagination .next,
html[data-theme="dark"] .page-nav a strong:after,
html[data-theme="dark"] .post-item.protected .thum:before,
html[data-theme="dark"] .sidebar .social-channel ul li a,
html[data-theme="dark"] .sidebar .tab-ui h2 a:before,
html[data-theme="dark"] #aside .profile ul li:before {
  filter: invert(1) hue-rotate(180deg);
}

/* ?ъ씠?쒕컮 쨌 ?명꽣 쨌 湲고? */
html[data-theme="dark"] #aside {
  background-color: var(--sk-bg);
}

html[data-theme="dark"] .sidebar .sidebar-2 {
  border-top-color: var(--sk-border);
}

html[data-theme="dark"] .sidebar ul li,
html[data-theme="dark"] .sidebar ul li a,
html[data-theme="dark"] .sidebar .count p,
html[data-theme="dark"] #footer p,
html[data-theme="dark"] #footer .order-menu a,
html[data-theme="dark"] .not-found li {
  color: var(--sk-muted);
}

html[data-theme="dark"] .sidebar .category ul li a,
html[data-theme="dark"] .sidebar .count .total,
html[data-theme="dark"] .sidebar ul li a:hover,
html[data-theme="dark"] #footer .order-menu a:hover {
  color: var(--sk-text);
}

html[data-theme="dark"] .sidebar .category ul li ul li ul li:before,
html[data-theme="dark"] .sidebar .social-channel ul li a {
  border-color: var(--sk-border);
}

html[data-theme="dark"] .sidebar .category ul li ul li ul li:before {
  background-color: var(--sk-border);
}

html[data-theme="dark"] #aside .profile:before {
  background-color: var(--sk-surface-2);
}

html[data-theme="dark"] #aside .profile ul li,
html[data-theme="dark"] #aside .profile ul li a {
  color: var(--sk-text);
}

html[data-theme="dark"] hr {
  border-color: var(--sk-border);
}

html[data-theme="dark"] .absent_post,
html[data-theme="dark"] .absent_post:before {
  color: var(--sk-text) !important;
}

html[data-theme="dark"] #content .another_category {
  background-color: var(--sk-surface) !important;
  border: 1px solid var(--sk-border);
}

html[data-theme="dark"] #content .another_category th a,
html[data-theme="dark"] #content .another_category td a,
html[data-theme="dark"] #content .another_category h4 {
  color: var(--sk-text) !important;
}

/* ---------------------------------------------------------------
 * C. ?ㅻ뜑 / ?대퉬寃뚯씠?? * --------------------------------------------------------------- */
#header {
  transition: box-shadow .25s var(--sk-ease), background-color .25s var(--sk-ease);
}

#header h1,
#gnb {
  transition: padding .25s var(--sk-ease), height .25s var(--sk-ease);
}

/* ?곗뒪?ы넲?먯꽌留??ㅻ뜑 怨좎젙 ??紐⑤컮?쇱? ?먮낯 ?숈옉 ?좎?(?붾㈃?????≪븘癒뱀쓬) */
@media (min-width: 768px) {
  #header {
    position: sticky;
    top: 0;
    z-index: 200;
    background-color: var(--sk-bg);
  }

  #header.is-scrolled {
    box-shadow: 0 1px 0 var(--sk-border), 0 6px 20px rgba(16, 24, 40, .06);
  }

  #header.is-scrolled h1 {
    padding-top: 14px;
    padding-bottom: 14px;
  }

  #header.is-scrolled #gnb {
    height: 52px;
  }

  #header.is-scrolled #gnb ul li a {
    padding-top: 15px;
    padding-bottom: 17px;
  }

  /* ?ㅻ뜑媛 以꾩뼱?ㅻ㈃ ?곗륫 ?좏떥(寃?됀룻넗湲쨌?꾨줈????媛숈씠 ?щ씪????쒕떎 */
  #header .util {
    transition: top .25s var(--sk-ease);
  }

  #header.is-scrolled .util {
    top: 15px;
  }

  html[data-theme="dark"] #header.is-scrolled {
    box-shadow: 0 1px 0 var(--sk-border), 0 8px 24px rgba(0, 0, 0, .45);
  }
}

/* 寃?됱갹: ?대졇?????ъ씤??而щ윭 ?뚮몢由?*/
#header .util .search.on input:focus {
  border-color: var(--sk-accent) !important;
  box-shadow: 0 0 0 3px var(--sk-accent-soft);
}

/* ?ㅽ겕紐⑤뱶 ?좉? 踰꾪듉 */
.sk-theme-toggle {
  position: relative;
  z-index: 20;
  float: left;
  width: 32px;
  height: 32px;
  margin-left: 10px;
  border: 1px solid var(--sk-border);
  border-radius: 50%;
  background-color: var(--sk-surface);
  cursor: pointer;
  transition: background-color .2s var(--sk-ease), border-color .2s var(--sk-ease), transform .2s var(--sk-ease);
}

.sk-theme-toggle:hover {
  border-color: var(--sk-accent-line);
  transform: rotate(-12deg);
}

.sk-theme-toggle__icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: transparent;
  box-shadow: inset -4px -4px 0 0 #6b7280;
  /* 珥덉듅??*/
  transform: rotate(-25deg);
  transition: box-shadow .25s var(--sk-ease), transform .35s var(--sk-ease);
}

html[data-theme="dark"] .sk-theme-toggle__icon {
  box-shadow: inset 0 0 0 2px #fbbf24, 0 0 0 2px rgba(251, 191, 36, .28);
  /* ?쒖뼇 */
  transform: rotate(0);
}

/* 紐⑤컮?? ?꾨줈?꾩씠 ?④퀬 寃?됱? ?ㅻⅨ履??뺣젹?섎?濡??좉????ㅻⅨ履쎌쑝濡?遺숈씤??   (?쒕ぉ h1 ??z-index:10 濡??꾩뿉 源붾━湲??뚮Ц???쇱そ???먮㈃ 媛?ㅼ쭊?? */
@media (max-width: 767px) {
  .sk-theme-toggle {
    float: right;
    margin: 0 12px 0 0;
  }
}

/* ---------------------------------------------------------------
 * D. ?쎄린 吏꾪뻾瑜?쨌 ?뚮줈??踰꾪듉 쨌 ?좎뒪?? * --------------------------------------------------------------- */
.sk-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 500;
  width: 100%;
  height: 3px;
  background: transparent;
  pointer-events: none;
}

.sk-progress__bar {
  display: block;
  width: 0;
  height: 100%;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(90deg, var(--sk-accent), #7c3aed 60%, #22d3ee);
  transition: width .12s linear;
}

body:not(.sk-post) .sk-progress {
  display: none;
}

.sk-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  z-index: 250;
  display: flex;
  flex-direction: column;
  opacity: 0;
  visibility: hidden;
  transform: translateY(12px);
  transition: opacity .25s var(--sk-ease), transform .25s var(--sk-ease), visibility .25s;
}

.sk-fab.is-on {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.sk-fab__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--sk-border);
  border-radius: 50%;
  background-color: var(--sk-surface);
  box-shadow: var(--sk-shadow-2);
  color: var(--sk-text);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: transform .2s var(--sk-ease), background-color .2s var(--sk-ease), color .2s var(--sk-ease);
}

/* flex gap ???margin ??援ы삎 ?ы뙆由ъ뿉?쒕룄 媛꾧꺽???좎??쒕떎 */
.sk-fab__btn+.sk-fab__btn {
  margin-top: 10px;
}

.sk-fab__btn:hover,
.sk-fab__btn:focus {
  background-color: var(--sk-accent);
  border-color: var(--sk-accent);
  color: #fff;
  transform: translateY(-2px);
}

.sk-toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  z-index: 700;
  max-width: 84vw;
  padding: 11px 20px;
  border-radius: 999px;
  background-color: rgba(17, 19, 23, .92);
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 12px);
  transition: opacity .2s var(--sk-ease), transform .2s var(--sk-ease), visibility .2s;
}

.sk-toast.is-on {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

html[data-theme="dark"] .sk-toast {
  background-color: rgba(240, 242, 246, .95);
  color: #15171b;
}

/* ---------------------------------------------------------------
 * E. 紐⑹감(TOC) 쨌 紐⑤컮???쒗듃
 * --------------------------------------------------------------- */
.sk-toc {
  font-size: 0.8125em;
}

.sk-toc__title {
  margin-bottom: 10px !important;
  font-weight: 700 !important;
  font-size: 0.875em !important;
  letter-spacing: -.01em;
  color: var(--sk-text-strong) !important;
}

.sk-toc__list {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: sk-toc;
}

.sk-toc__item {
  padding: 0 !important;
  margin: 0;
  list-style: none;
}

.sk-toc__item a {
  position: relative;
  display: block;
  padding: 6px 8px 6px 12px;
  border-radius: 8px;
  color: var(--sk-muted) !important;
  line-height: 1.5;
  text-decoration: none;
  transition: color .18s var(--sk-ease), background-color .18s var(--sk-ease);
}

.sk-toc__item a:before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 0;
  margin-top: -1px;
  border-radius: 3px;
  background-color: var(--sk-accent);
  transition: height .2s var(--sk-ease), margin-top .2s var(--sk-ease);
}

.sk-toc__item.is-sub a {
  padding-left: 24px;
  font-size: 0.94em;
}

.sk-toc__item a:hover {
  background-color: var(--sk-accent-soft);
  color: var(--sk-text) !important;
}

.sk-toc__item a.is-active {
  color: var(--sk-accent) !important;
  font-weight: 600;
}

.sk-toc__item a.is-active:before {
  height: 16px;
  margin-top: -8px;
}

/* ?곗뒪?ы넲: ?ъ씠?쒕컮 ?곷떒??遺숈뼱 ?곕씪?ㅻ뒗 紐⑹감 */
.sk-toc--rail {
  position: sticky;
  top: 128px;
  max-height: calc(100vh - 190px);
  overflow-y: auto;
  margin-bottom: 34px;
  padding: 16px 4px 16px 12px;
  border-left: 2px solid var(--sk-border);
  overscroll-behavior: contain;
}

@media (max-width: 1024px) {
  .sk-toc--rail {
    display: none !important;
  }
}

/* 紐⑤컮?? ?섎떒 ?쒗듃 */
.sk-sheet {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 600;
}

.sk-sheet__dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, .5);
  opacity: 0;
  transition: opacity .22s var(--sk-ease);
}

.sk-sheet.is-on .sk-sheet__dim {
  opacity: 1;
}

.sk-sheet__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  padding: 4px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  border-radius: 18px 18px 0 0;
  background-color: var(--sk-surface);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, .28);
  transform: translateY(100%);
  transition: transform .26s var(--sk-ease);
}

.sk-sheet.is-on .sk-sheet__panel {
  transform: none;
}

.sk-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 4px 10px;
  border-bottom: 1px solid var(--sk-border);
  color: var(--sk-text-strong);
  font-size: 15px;
}

.sk-sheet__close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--sk-muted);
  font-size: 15px;
  cursor: pointer;
}

.sk-sheet__close:hover {
  background-color: var(--sk-surface-2);
  color: var(--sk-text);
}

.sk-sheet .sk-toc--sheet {
  overflow-y: auto;
  padding: 10px 0 6px;
  font-size: 0.95em;
  overscroll-behavior: contain;
}

.sk-sheet .sk-toc__item a {
  padding: 11px 10px 11px 14px;
  /* 紐⑤컮???곗튂 ?源??뺣낫 */
}

body.sk-lock {
  overflow: hidden;
}

@media (min-width: 1025px) {
  .sk-fab__btn.is-toc {
    display: none;
  }
}

/* ---------------------------------------------------------------
 * F. ?쎄린 ?꾧뎄 (?쎈뒗 ?쒓컙 쨌 湲???ш린)
 * --------------------------------------------------------------- */
.post-cover .meta .sk-readtime {
  color: inherit;
}

.sk-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0 26px;
  padding: 10px 4px;
  border-top: 1px solid var(--sk-border);
  border-bottom: 1px solid var(--sk-border);
}

.sk-tools__info {
  margin: 0 !important;
  font-size: 0.8125em;
  color: var(--sk-muted);
}

.sk-fs {
  display: inline-flex;
  align-items: center;
  flex: none;
}

.sk-fs__btn {
  margin: 0 2px;
  width: 34px;
  height: 30px;
  border: 1px solid var(--sk-border);
  border-radius: 8px;
  background-color: var(--sk-surface);
  color: var(--sk-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background-color .18s var(--sk-ease), border-color .18s var(--sk-ease), opacity .18s;
}

.sk-fs__btn sup {
  font-size: 9px;
}

.sk-fs__btn:hover:not(:disabled) {
  border-color: var(--sk-accent-line);
  background-color: var(--sk-accent-soft);
}

.sk-fs__btn:disabled {
  opacity: .38;
  cursor: default;
}

.sk-fs__val {
  min-width: 46px;
  font-size: 0.75em;
  color: var(--sk-muted);
  text-align: center;
}

/* 湲???ш린 ?④퀎 ???몃씪???ㅽ??쇰줈 諛뺥엺 蹂몃Ц ?ш린瑜??④퀎蹂꾨줈 ??뼱?대떎 */
html[data-fs="1"] .entry-content p,
html[data-fs="1"] .entry-content li {
  font-size: 18.5px !important;
  line-height: 1.95 !important;
}

html[data-fs="1"] .entry-content h2 {
  font-size: 30px !important;
}

html[data-fs="1"] .entry-content h3 {
  font-size: 23px !important;
}

html[data-fs="2"] .entry-content p,
html[data-fs="2"] .entry-content li {
  font-size: 20.5px !important;
  line-height: 2.02 !important;
}

html[data-fs="2"] .entry-content h2 {
  font-size: 33px !important;
}

html[data-fs="2"] .entry-content h3 {
  font-size: 25px !important;
}

/* ---------------------------------------------------------------
 * G. 蹂몃Ц ??댄룷 & ?붿냼
 * --------------------------------------------------------------- */
.entry-content {
  font-size: 1.0625em;
  line-height: 1.85;
  color: var(--sk-text);
}

.entry-content h1,
.entry-content h2,
.entry-content h3,
.entry-content h4 {
  scroll-margin-top: 124px;
  /* ?듭빱(紐⑹감) ?대룞 ???ㅽ떚???ㅻ뜑??媛由ъ? ?딄쾶 */
}

@media (max-width: 767px) {

  .entry-content h1,
  .entry-content h2,
  .entry-content h3,
  .entry-content h4 {
    scroll-margin-top: 20px;
  }
}

.entry-content a {
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  transition: color .15s var(--sk-ease), background-color .15s var(--sk-ease);
}

.entry-content a:hover {
  text-decoration: underline;
}

.entry-content .sk-extlink:after {
  content: "??;
  display: inline-block;
  margin-left: 2px;
  font-size: .82em;
  vertical-align: top;
  opacity: .6;
}

/* ?대?吏: 濡쒕뱶 ??遺?쒕읇寃??깆옣 */
.entry-content .sk-img {
  opacity: 0;
  transition: opacity .45s var(--sk-ease);
}

.entry-content .sk-img.is-loaded {
  opacity: 1;
}

.entry-content figure img {
  box-shadow: var(--sk-shadow-1);
}

.entry-content figcaption,
.entry-content caption {
  word-break: keep-all;
}

/* ?? 紐⑤컮??媛濡??ㅽ겕濡?+ ?ㅽ겕濡?媛???뚰듃 */
.sk-tablewrap {
  position: relative;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 0 26px;
  border-radius: 10px;
}

.sk-tablewrap>table {
  margin-bottom: 0 !important;
}

.sk-tablewrap:focus-visible {
  outline: 2px solid var(--sk-accent);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .sk-tablewrap:after {
    content: "??醫뚯슦濡??섍꺼蹂댁꽭????;
    display: block;
    padding: 4px 2px 2px;
    font-size: 11px;
    color: var(--sk-muted);
    text-align: center;
  }
}

/* 肄붾뱶 釉붾줉 + 蹂듭궗 踰꾪듉 */
.sk-codewrap {
  position: relative;
}

.sk-codewrap pre {
  padding: 18px 16px;
  border: 1px solid var(--sk-border);
  border-radius: var(--sk-radius);
  background-color: var(--sk-surface-2);
  font-family: 'SFMono-Regular', Consolas, 'D2Coding', monospace;
  font-size: 0.9em;
  line-height: 1.7;
  overflow-x: auto;
}

.sk-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 5px 10px;
  border: 1px solid var(--sk-border);
  border-radius: 7px;
  background-color: var(--sk-surface);
  color: var(--sk-muted);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  opacity: 0;
  transition: opacity .18s var(--sk-ease), color .18s var(--sk-ease);
}

.sk-codewrap:hover .sk-copy,
.sk-copy:focus {
  opacity: 1;
}

.sk-copy:hover {
  color: var(--sk-text);
  border-color: var(--sk-border-strong);
}

@media (hover: none) {
  .sk-copy {
    opacity: 1;
  }
}

/* ?몄슜臾?쨌 援щ텇???ㅻ벉湲?*/
.entry-content blockquote {
  border-left-width: 3px;
  border-left-color: var(--sk-accent-line);
  border-radius: 0 10px 10px 0;
  background-color: var(--sk-accent-soft);
  color: var(--sk-text);
}

.entry-content hr {
  border-bottom-color: var(--sk-border) !important;
}

html[data-theme="dark"] .entry-content {
  color: var(--sk-text);
}

html[data-theme="dark"] .entry-content h1,
html[data-theme="dark"] .entry-content h2,
html[data-theme="dark"] .entry-content h3,
html[data-theme="dark"] .entry-content h4 {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .entry-content blockquote {
  background-color: rgba(167, 139, 250, .10);
}

html[data-theme="dark"] .entry-content .protected_form h2 {
  color: var(--sk-text-strong);
}

html[data-theme="dark"] .entry-content .protected_form p {
  color: var(--sk-muted);
}

html[data-theme="dark"] .entry-content input,
html[data-theme="dark"] .entry-content textarea {
  background-color: var(--sk-surface-2);
  border-color: var(--sk-border);
  color: var(--sk-text);
}

/* ---------------------------------------------------------------
 * H. ?먮룞 ?앹꽦 蹂몃Ц(?몃씪???ㅽ??? ?ㅽ겕 紐⑤뱶 ??? *    蹂몃Ц? ?ㅽ궓怨?臾닿??섍쾶 蹂댁씠?꾨줉 ?몃씪???ㅽ??쇰줈 ?됱씠 諛뺥? ?덈떎.
 *    ?ㅽ겕 紐⑤뱶?먯꽌 '寃? 諛곌꼍 + 寃? 湲??媛 ?섏? ?딄쾶 ?뺥솗???섏쭦?붾떎.
 * --------------------------------------------------------------- */
html[data-theme="dark"] .entry-content [style*="color:#111"],
html[data-theme="dark"] .entry-content [style*="color:#222"],
html[data-theme="dark"] .entry-content [style*="color:#333"],
html[data-theme="dark"] .entry-content [style*="color: #111"],
html[data-theme="dark"] .entry-content [style*="color: #222"],
html[data-theme="dark"] .entry-content [style*="color: #333"] {
  color: var(--sk-text) !important;
}

html[data-theme="dark"] .entry-content [style*="color:#555"],
html[data-theme="dark"] .entry-content [style*="color:#666"],
html[data-theme="dark"] .entry-content [style*="color:#777"],
html[data-theme="dark"] .entry-content [style*="color:#999"] {
  color: var(--sk-muted) !important;
}

/* ?뚯젣紐?諛묒쨪 */
html[data-theme="dark"] .entry-content [style*="border-bottom:3px solid #222"],
html[data-theme="dark"] .entry-content [style*="border-bottom:2px solid #222"] {
  border-bottom-color: var(--sk-border-strong) !important;
}

/* 援щ텇??*/
html[data-theme="dark"] .entry-content [style*="border-top:1px solid #e5e5e5"] {
  border-top-color: var(--sk-border) !important;
}

/* '??以??뺣━' 諛뺤뒪 */
html[data-theme="dark"] .entry-content [style*="#f4f6ff"] {
  background: #20244a !important;
  border-left-color: #a78bfa !important;
  color: #e7e9f5 !important;
}

/* '??湲???듭떖' / '紐⑹감' 諛뺤뒪 */
html[data-theme="dark"] .entry-content [style*="background:#fafafa"],
html[data-theme="dark"] .entry-content [style*="background:#fbfbfb"] {
  background: var(--sk-surface) !important;
  border-color: var(--sk-border) !important;
  color: var(--sk-text) !important;
}

/* ?뮕 肄쒖븘??*/
html[data-theme="dark"] .entry-content [style*="#fff8e1"] {
  background: #2b2313 !important;
  border-left-color: #f59e0b !important;
  color: #f0e4cd !important;
}

/* ??*/
html[data-theme="dark"] .entry-content [style*="background:#f5f5f5"] {
  background: var(--sk-surface-2) !important;
  border-color: var(--sk-border-strong) !important;
  color: var(--sk-text-strong) !important;
}

html[data-theme="dark"] .entry-content [style*="border:1px solid #ddd"] {
  border-color: var(--sk-border-strong) !important;
}

/* 蹂몃Ц ??留곹겕(紐⑹감쨌李멸퀬?먮즺)??蹂대씪?????ㅽ겕?먯꽌 諛앹? 蹂대씪濡?*/
html[data-theme="dark"] .entry-content [style*="color:#4c1d95"],
html[data-theme="dark"] .entry-content a[style*="#4c1d95"] {
  color: var(--sk-accent) !important;
}

/* ?쇱씠??紐⑤뱶?먯꽌??諛뺤뒪???꾩＜ ?낆? 洹몃┝?먮? ?뱀뼱 ?낆껜媛먯쓣 以??*/
.entry-content [style*="border-radius:8px"][style*="background"] {
  box-shadow: var(--sk-shadow-1);
}

/* ---------------------------------------------------------------
 * I. ?좊뱶?쇱뒪 愿묎퀬 ?곸뿭
 *    - 蹂몃Ц怨??뺤떎??援щ텇?섎뒗 移대뱶 + '愿묎퀬' ?쇰꺼 (?뺤콉 以??
 *    - color-scheme:light : ?ㅽ겕 紐⑤뱶?먯꽌??愿묎퀬 ?대? ?띿뒪??媛?낆꽦 ?좎?
 * --------------------------------------------------------------- */
.sk-ad {
  position: relative;
  clear: both;
  margin: 40px 0;
  padding: 12px 10px;
  border: 1px solid var(--sk-border);
  border-radius: var(--sk-radius-lg);
  background-color: var(--sk-surface);
  text-align: center;
  overflow: hidden;
  color-scheme: light;
}

.sk-ad__label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .06em;
  color: var(--sk-muted);
}

.sk-ad ins {
  display: block;
  margin: 0 auto;
}

.sk-ad--inarticle {
  min-height: 120px;
}

.sk-ad--bottom,
.sk-ad--multiplex {
  margin: 44px 0 8px;
}

.sk-adzone:empty {
  display: none;
}

/* ?곗뒪?좊━ 湲곕낯 愿묎퀬 ?곸뿭??媛숈? ?щ갚 洹쒖튃???곕Ⅴ寃?*/
.revenue_unit_wrap.position_list,
.revenue_unit_wrap {
  margin: 34px auto !important;
}

html[data-theme="dark"] .sk-ad {
  background-color: #f7f8fa;
  border-color: #e3e5e9;
}

html[data-theme="dark"] .sk-ad__label {
  color: #6b7280;
}

@media (max-width: 767px) {
  .sk-ad {
    margin: 32px 0;
    border-radius: 12px;
  }
}

/* ---------------------------------------------------------------
 * J. 怨듭쑀 踰꾪듉
 * --------------------------------------------------------------- */
.sk-share {
  margin: 44px 0 40px;
  padding: 22px 0 0;
  border-top: 1px solid var(--sk-border);
}

.sk-share__title {
  margin: 0 0 14px !important;
  font-weight: 600 !important;
  font-size: 1em !important;
  color: var(--sk-text-strong);
}

.sk-share__list {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: -8px;
}

.sk-share__btn {
  display: inline-flex;
  align-items: center;
  margin: 0 8px 8px 0;
  padding: 9px 15px;
  border: 1px solid var(--sk-border);
  border-radius: 999px;
  background-color: var(--sk-surface);
  color: var(--sk-text);
  font-size: 13px;
  line-height: 1.4;
  text-decoration: none !important;
  cursor: pointer;
  transition: transform .18s var(--sk-ease), border-color .18s var(--sk-ease), background-color .18s var(--sk-ease), color .18s var(--sk-ease);
}

.sk-share__btn span {
  margin-right: 6px;
  font-size: 13px;
  line-height: 1;
}

.sk-share__btn:hover,
.sk-share__btn:focus {
  transform: translateY(-2px);
  border-color: transparent;
  color: #fff;
}

.sk-share__btn.is-copy:hover,
.sk-share__btn.is-copy:focus,
.sk-share__btn.is-native:hover,
.sk-share__btn.is-native:focus {
  background-color: var(--sk-accent);
}

.sk-share__btn.is-x:hover,
.sk-share__btn.is-x:focus {
  background-color: #111;
}

.sk-share__btn.is-fb:hover,
.sk-share__btn.is-fb:focus {
  background-color: #1877f2;
}

.sk-share__btn.is-band:hover,
.sk-share__btn.is-band:focus {
  background-color: #08bf5b;
}

/* ---------------------------------------------------------------
 * K. 紐⑸줉 / 移대뱶 / ?쒓렇 / ?섏씠吏? * --------------------------------------------------------------- */
.post-item .thum,
.cover-thumbnail-1 ul li figure,
.cover-thumbnail-2 ul li figure,
.cover-thumbnail-4 ul li figure,
.related-articles ul li figure {
  overflow: hidden;
  border-radius: var(--sk-radius);
}

.post-item .thum img,
.cover-thumbnail-1 ul li figure img,
.cover-thumbnail-2 ul li figure img,
.cover-thumbnail-4 ul li figure img,
.related-articles ul li figure img {
  transition: transform .55s var(--sk-ease), filter .3s var(--sk-ease);
}

.post-item a:hover .thum img,
.post-item a:focus .thum img {
  transform: translateY(-25%) scale(1.05);
}

.list-type-vertical .post-item a:hover .thum img,
.list-type-vertical .post-item a:focus .thum img,
.list-type-thumbnail .post-item a:hover .thum img,
.list-type-thumbnail .post-item a:focus .thum img {
  transform: scale(1.05);
}

.cover-thumbnail-1 ul li a:hover figure img,
.cover-thumbnail-2 ul li a:hover figure img,
.cover-thumbnail-4 ul li a:hover figure img,
.related-articles ul li a:hover figure img {
  transform: scale(1.05);
}

.post-item .title,
.cover-list ul li .title,
.related-articles ul li .title {
  transition: color .18s var(--sk-ease);
}

.post-item a:hover .title,
.post-item a:focus .title,
.cover-list ul li a:hover .title,
.related-articles ul li a:hover .title {
  color: var(--sk-accent);
  text-decoration-color: var(--sk-accent-line);
  text-underline-offset: 3px;
}

.related-articles ul li a {
  display: block;
  border-radius: var(--sk-radius);
  transition: transform .22s var(--sk-ease);
}

.related-articles ul li a:hover {
  transform: translateY(-3px);
}

.tags a {
  background-color: var(--sk-surface);
  transition: border-color .18s var(--sk-ease), background-color .18s var(--sk-ease), color .18s var(--sk-ease), transform .18s var(--sk-ease);
}

.tags a:hover,
.tags a:focus {
  border-color: var(--sk-accent-line) !important;
  background-color: var(--sk-accent-soft);
  color: var(--sk-accent) !important;
  transform: translateY(-1px);
}

.pagination a {
  border-radius: 8px;
  transition: color .18s var(--sk-ease), background-color .18s var(--sk-ease);
}

.pagination a:not(.prev):not(.next):hover {
  background-color: var(--sk-accent-soft);
  color: var(--sk-accent);
}

.pagination .selected {
  font-weight: 700;
  color: var(--sk-accent) !important;
}

.pagination .view-more:hover,
.cover-thumbnail-2 .more:hover,
.comment-list .tt_more_preview_comments_text:hover {
  border-color: var(--sk-accent-line) !important;
  background-color: var(--sk-accent-soft);
  color: var(--sk-accent) !important;
  text-decoration: none;
}

/* '寃??寃곌낵 ?놁쓬' 媛쒖꽑 */
.sk-btn-home {
  display: inline-block;
  margin-top: 18px;
  padding: 11px 22px;
  border-radius: 999px;
  background-color: var(--sk-accent);
  color: #fff !important;
  font-size: 0.875em;
  text-decoration: none !important;
  transition: transform .18s var(--sk-ease), opacity .18s var(--sk-ease);
}

.sk-btn-home:hover {
  transform: translateY(-2px);
  opacity: .92;
}

/* ?ㅽ겕濡??깆옣 (JS 媛 ?대옒?ㅻ? 遺숈씪 ?뚮쭔 ?곸슜 ??JS ?ㅽ뙣 ???댁슜???⑥? ?딅뒗?? */
.sk-reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity .5s var(--sk-ease), transform .5s var(--sk-ease);
}

.sk-reveal.is-in {
  opacity: 1;
  transform: none;
}

/* ---------------------------------------------------------------
 * L. ?ъ씠?쒕컮 쨌 ?볤? 쨌 ?명꽣
 * --------------------------------------------------------------- */
.sidebar .post-list ul li img,
.sidebar .social-list ul li .avatar {
  border-radius: 8px;
}

.sidebar .post-list ul li a,
.sidebar .recent-comment ul li a,
.sidebar .notice ul li a {
  transition: color .18s var(--sk-ease);
}

.sidebar .social-channel ul li a {
  transition: transform .2s var(--sk-ease), background-color .2s var(--sk-ease);
}

.sidebar .social-channel ul li a:hover {
  transform: translateY(-2px);
}

/* ?볤?: ?곗뒪?좊━ 湲곕낯 留덊겕???ㅽ겕 紐⑤뱶 ???*/
html[data-theme="dark"] .tt-comments-wrap,
html[data-theme="dark"] .tt-comment-cont {
  color: var(--sk-text);
}

html[data-theme="dark"] .tt-comment-cont .tt_txt_g,
html[data-theme="dark"] .tt-comment-cont .tt_desc,
html[data-theme="dark"] .tt-comment-cont .tt-txt-mention,
html[data-theme="dark"] .tt-comment-cont .tt-link-user,
html[data-theme="dark"] .comment-list ul li .author-meta,
html[data-theme="dark"] .comment-list ul li .author-meta a {
  color: var(--sk-text) !important;
}

html[data-theme="dark"] .tt-comments-wrap input,
html[data-theme="dark"] .tt-comments-wrap textarea,
html[data-theme="dark"] .tt-comment-cont textarea {
  background-color: var(--sk-surface-2) !important;
  border-color: var(--sk-border) !important;
  color: var(--sk-text) !important;
}

html[data-theme="dark"] .tt-comment-cont .tt-btn_register {
  background-color: var(--sk-accent) !important;
  border-color: var(--sk-accent) !important;
  color: #fff !important;
}

#footer .page-top {
  transition: background-color .2s var(--sk-ease), transform .2s var(--sk-ease);
}

#footer .page-top:hover {
  transform: translateY(-2px);
}

/* ---------------------------------------------------------------
 * M. ?묎렐??쨌 紐⑥뀡 쨌 ?몄뇙
 * --------------------------------------------------------------- */
a:focus-visible,
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--sk-accent) !important;
  outline-offset: 2px;
  border-radius: 4px;
}

#header .util .search input:focus-visible,
#header .util .search button:focus-visible,
#header .util .profile button:focus-visible,
#header .util .menu:focus-visible,
.sk-theme-toggle:focus-visible,
.cover-thumbnail-3 button:focus-visible,
.cover-thumbnail-4 button:focus-visible {
  outline: 2px solid var(--sk-accent) !important;
  outline-offset: 2px;
}

/* ?곗튂 ?源?理쒖냼 ?ш린 蹂댁젙 */
@media (max-width: 767px) {

  #gnb ul li a {
    min-height: 44px;
  }

  .sk-fab__btn {
    width: 48px;
    height: 48px;
  }

  .sk-tools {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {

  *,
  *::before,
  *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }

  .sk-reveal {
    opacity: 1;
    transform: none;
  }
}

@media print {

  #header,
  #aside,
  #footer,
  #gnb,
  .main-slider,
  .sk-progress,
  .sk-fab,
  .sk-toast,
  .sk-sheet,
  .sk-share,
  .sk-tools,
  .sk-ad,
  .sk-copy,
  .revenue_unit_wrap,
  .comments,
  .container_postbtn,
  .related-articles {
    display: none !important;
  }

  #content {
    float: none !important;
    width: 100% !important;
    padding: 0 !important;
  }

  body,
  .entry-content {
    color: #000 !important;
    background: #fff !important;
  }

  .entry-content a {
    color: #000 !important;
    text-decoration: underline;
  }

  .entry-content a[href^="http"]:after {
    content: " (" attr(href) ")";
    font-size: 11px;
    color: #555;
  }

  #container .content-wrap:before {
    display: none !important;
  }
}

/* ?ㅽ겕 紐⑤뱶?먯꽌 ?대?吏쨌?곸긽 ?덈??ъ쓣 ?댁쭩 以꾩씤??*/
html[data-theme="dark"] .entry-content img,
html[data-theme="dark"] .post-item .thum img,
html[data-theme="dark"] .related-articles ul li figure img {
  filter: brightness(.94) contrast(1.02);
}
