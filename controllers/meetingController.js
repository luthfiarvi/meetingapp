import meetingModel from "../models/meetingModel.js";  


export const formMeeting = (req, res) => {
    res.render("inputrapat");
};

export const showMeeting = async (req, res) => {
    console.log("Trolololo");
    try {
        const meetings = await meetingModel.getAllMeeting();
        res.render("meetingmanajemen", { meetings });
    } catch (error) {
        console.error("Database Error (showMeeting):", error.message);
        res.render("meetingmanajemen", { meetings: [] });
    }
};

export const inputMeeting = async (req,res) => {
    console.log("Trilililili");
    const {m_nama,deskripsi,tanggal,m_tipe} = req.body;
    
    console.log(m_nama,deskripsi,tanggal,m_tipe);
    
    await meetingModel.createMeeting({m_nama,deskripsi,tanggal,m_tipe});
    console.log("Data sdh diinput!");

    res.redirect("/manajemenmeeting");
}

//-------------------------------------------------------------------------------------------------------------------------//
function UploadDokumen(path, filenya) {
    uploadPath = `public/dokumen/${path}`;
    console.log(uploadPath);

    // Use the mv() method to place the file somewhere on your server
    filenya.mv(uploadPath, function (err) {
        if (err)
            return res.status(500).send(err);

        //res.send('File uploaded!');
    });
}