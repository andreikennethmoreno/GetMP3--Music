//declare modules
import express from "express";
//for file management 
import bodyParser from "body-parser";
import fs from 'fs';
import path from 'path';
//Youtube Api and Download logic
import yts from 'yt-search';
import ytdl from 'ytdl-core';
//format for .mp3 files
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

const app = express();
//List of converted songs
let songList = [];
//list of user search results
let songSearchList = [];

//converts to yt playlist link to yt id for yt search to read
function getPlaylistId(youtubeLink) {
  const regex = /list=([A-Za-z0-9_-]+)/;
  const match = youtubeLink.match(regex);
  if (match && match[1]) {
      return match[1];
  } else {
      return null; 
  }
}

//deletes the contents of the /Downloads folder
function deleteFolderContents(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const filePath = path.join(folderPath, file);
      fs.unlinkSync(filePath);
    });
    console.log('All contents of the folder have been deleted.');
  } else {
    console.log('Folder not found.');
  }
}

//converts seconds to readable time
function formatTime(seconds) {
  // Calculate minutes and seconds
  let minutes = Math.floor(seconds / 60);
  let remainingSeconds = seconds % 60;
  // Format to ensure two digits
  let formattedMinutes = String(minutes).padStart(2, '0');
  let formattedSeconds = String(remainingSeconds).padStart(2, '0');
  // Combine into MM:SS format
  return `${formattedMinutes}:${formattedSeconds}`;
}

//makes sure the folder is empty on startup
deleteFolderContents("./Downloads")

//constructor for the user search song
function SongSearch(url, title, thumbnail,  duration) {
  this.url = url;
  this.title = title;
  this.thumbnail = thumbnail;
  this.duration = duration;
}

//constructor for the song to be downloaded
function Song(title , thumbnail, duration ) {
  this.title = title;
  this.thumbnail = thumbnail;
  this.duration = duration;
}
//allows body parser to used
app.use(bodyParser.urlencoded({ extended: true }));
//allows access to the public folder
app.use(express.static("public"));
//finds the executable file
ffmpeg.setFfmpegPath(ffmpegPath);

//Search or Home page
app.get("/", (req, res) => {
  deleteFolderContents("./Downloads")
  songList = [];
  res.render('search.ejs', {
    songSearchList : songSearchList,
  });
});

//Yt link to single song page
app.get("/single", (req, res) => {
  deleteFolderContents("./Downloads")
  songList = [];
  res.render('convert.ejs', {

  });
});

//about the creator page
app.get("/about", (req, res) => {
  res.render('about.ejs', {
  });
});

//Yt link to playlist song page
app.get("/album", (req, res) => {
  deleteFolderContents("./Downloads")
  songList = [];
  res.render('convertAlbum.ejs', {
  });
});

//Takes in user search request
app.post("/searchSong", async (req, res) => {
  songSearchList = [];
  //console.log(req.body.userSearch);
  //gets the user input on default it is ' '
 const userSearch = req.body.userSearch || ' ';
  //try catch for async request from yts search
  try {
    //converts user input to usable string
    const r = await yts( userSearch )
    //gives the user about 30 videos 
    const videos = r.videos.slice( 0, 30 )
    //iterates over videos
    videos.forEach( function ( v ) {
      //an instance to be inserted into the searchSong list
      let songSearchInstance = new SongSearch(v.url, v.title , v.thumbnail , v.timestamp)
      //console.log(songSearchInstance)
      songSearchList.push(songSearchInstance);
    } )
    //console.log(songSearchList)
    //renders the search page back with the songSearch array filled with videos
    res.render('search.ejs', {
      songSearchList: songSearchList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Converts album requests
app.post("/convertAlbum", async (req, res) => {
  try {
    let ytAlbum = getPlaylistId(req.body.ytAlbum);
    const list = await yts({ listId: ytAlbum });

    let processingPromises = list.videos.map((video) => {
      return new Promise((resolve, reject) => {
        let videoStream = ytdl(video.videoId, { filter: 'audioonly' });
        let seconds = video.duration.seconds;
        let duration = formatTime(seconds);
        const isDuplicate = songList.some(song => song.title === video.title);

        if (isDuplicate) {
          console.log('Video already exists in the list:', video.title);
          resolve(); // Resolve early if duplicate
          return;
        }

        let outputFilePath = `./Downloads/${video.title}.mp3`;

        ffmpeg(videoStream)
          .audioCodec('libmp3lame')
          .format('mp3')
          .save(outputFilePath)
          .on('end', () => {
            let songInstance = new Song(video.title, video.thumbnail, duration);
            songList.push(songInstance);
            console.log(`Saved MP3 file: ${outputFilePath}`);
            resolve(); // Resolve the promise when done
          })
          .on('error', (err) => {
            console.error('Error converting to MP3:', err);
            reject(err); // Reject the promise on error
          });
      });
    });

    await Promise.all(processingPromises);
    console.log('All conversions completed.');
    res.render('download.ejs', {
      songList: songList,
    });
  } catch (error) {
    console.error('Error processing playlist:', error);
    res.status(500).send('Internal Server Error');
  }
});


//brings back the user to home page
app.get("/convertNext", (req, res) => {
  songList = []
  deleteFolderContents("./Downloads")
  res.render('search.ejs', {
    songSearchList: songSearchList,
  });
});

//converts a song requests
app.post("/convert", (req, res) => {
  //console.log(req.body.ytLink);
  //declare the user input link
  const videoUrl = req.body.ytLink;
  //fecthes the user input link
  ytdl.getInfo(videoUrl).then(info => {
    //declare variables for readablity
    let videoTitle = info.videoDetails.title;
    let thumbnail = info.videoDetails.thumbnails[3].url
    let seconds = info.videoDetails.lengthSeconds
    //conveerts seconds to readable format
    let duration  = formatTime(seconds);
    //reaplce invalid characters in the youtube title
    videoTitle = videoTitle.replace(/[\\\/:*?"<>|]/g, '_');
    //checks if the song title already exist
    const isDuplicate = songList.some(song => song.title === videoTitle);
    //if true just return it
    if (isDuplicate) {
      //console.log('Video already exists in the list.');
      return 
    }
    //new instance 
    let songInstance = new Song(videoTitle, thumbnail, duration)
    //inserts the song to the songList
    songList.push(songInstance);
    //console.log(songList);
    // Output MP3 file path
    const outputFilePath = `./Downloads/${videoTitle}.mp3`;
    // Create a read stream from the YouTube video
    let videoStream = ytdl(videoUrl, { filter: 'audioonly' });
    //converts the youtube video autdio to an mp3 file
    ffmpeg(videoStream)
    .audioCodec('libmp3lame')
    .format('mp3')
    .save(outputFilePath)
    .on('end', function() {
      console.log('The mp3 file has been saved successfully');
      //renders the download page when it is dones converting
      res.render('download.ejs', {
        songList: songList,
      });

    })
    .on('error', function(err) {
      console.log('An error occurred: ' + err.message);
    });
  })
  
});

//gets the title of the specific song
app.get('/download/:title', (req, res) => {
  //console.log('songlist'+songList)
  //decodes and declares the title parameter
  const title = decodeURIComponent(req.params.title);
  //console.log('song title is ' + title);
  //sets the file name === song.mp3
  const filename = title + '.mp3'; 
  //downloads the specific song , the user requested
  res.download(`./Downloads/${filename}`, function(err) {
    if (err) {
      console.error("Error downloading file:", err);
    } else {
      console.log("Download complete");
      res.render('download.ejs', {
        songList: songList,
      });
    }
  });
});

//local host server address
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
